"""
Arcadia BI Engine - Motor de Business Intelligence
Servico FastAPI que processa dados, executa queries SQL,
gera dados para charts e fornece micro-BI para modulos.

Porta padrao: 8004
"""

import os
import json
import hashlib
import time
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from collections import OrderedDict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pandas as pd
import numpy as np

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

app = FastAPI(
    title="Arcadia BI Engine",
    description="Motor de Business Intelligence - SQL, Charts, Micro-BI, Analise de Dados",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
MAX_ROWS = 10000
QUERY_TIMEOUT_MS = 30000
CACHE_TTL_SECONDS = 300

FORBIDDEN_KEYWORDS = [
    "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "TRUNCATE",
    "GRANT", "REVOKE", "EXECUTE", "EXEC", "COPY", "VACUUM", "REINDEX",
    "COMMENT", "SECURITY", "OWNER", "SET ROLE", "SET SESSION",
]

FORBIDDEN_PATTERNS = [
    r";\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)",
    r"--",
    r"/\*",
    r"pg_sleep",
    r"pg_terminate",
    r"pg_cancel",
    r"lo_import",
    r"lo_export",
]


class QueryCache:
    def __init__(self, max_size: int = 200, ttl: int = CACHE_TTL_SECONDS):
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl
        self._hits = 0
        self._misses = 0

    def _make_key(self, sql: str, params: dict = None) -> str:
        raw = f"{sql}:{json.dumps(params or {}, sort_keys=True, default=str)}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, sql: str, params: dict = None):
        key = self._make_key(sql, params)
        if key in self._cache:
            entry = self._cache[key]
            if time.time() - entry["ts"] < self._ttl:
                self._hits += 1
                self._cache.move_to_end(key)
                return entry["data"]
            else:
                del self._cache[key]
        self._misses += 1
        return None

    def set(self, sql: str, data: Any, params: dict = None):
        key = self._make_key(sql, params)
        if len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        self._cache[key] = {"data": data, "ts": time.time()}

    def invalidate(self, pattern: str = None):
        if pattern is None:
            self._cache.clear()
        else:
            keys_to_del = [k for k in self._cache if pattern in str(self._cache[k])]
            for k in keys_to_del:
                del self._cache[k]

    def stats(self):
        total = self._hits + self._misses
        return {
            "entries": len(self._cache),
            "max_size": self._max_size,
            "ttl_seconds": self._ttl,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total * 100, 1) if total > 0 else 0,
        }


cache = QueryCache()


class SQLQueryRequest(BaseModel):
    sql: str = Field(..., description="Query SQL (somente SELECT)")
    params: Optional[Dict[str, Any]] = Field(None, description="Parametros da query")
    limit: Optional[int] = Field(MAX_ROWS, description="Limite de linhas")
    use_cache: Optional[bool] = Field(True, description="Usar cache")

class ChartDataRequest(BaseModel):
    sql: Optional[str] = Field(None, description="Query SQL para os dados")
    table: Optional[str] = Field(None, description="Tabela fonte")
    x_axis: str = Field(..., description="Coluna eixo X / categorias")
    y_axis: str = Field(..., description="Coluna eixo Y / valores")
    aggregation: Optional[str] = Field("sum", description="Funcao de agregacao: sum, avg, count, min, max")
    group_by: Optional[str] = Field(None, description="Coluna para agrupamento adicional")
    time_grain: Optional[str] = Field(None, description="Granularidade temporal: day, week, month, quarter, year")
    filters: Optional[List[Dict[str, Any]]] = Field(None, description="Filtros [{column, operator, value}]")
    order_by: Optional[str] = Field(None, description="Ordenacao")
    limit: Optional[int] = Field(100, description="Limite de registros")

class MicroBIRequest(BaseModel):
    table: str = Field(..., description="Tabela fonte")
    metrics: Optional[List[str]] = Field(None, description="Metricas desejadas: count, sum, avg, etc")
    dimension: Optional[str] = Field(None, description="Dimensao para agrupar")
    filters: Optional[List[Dict[str, Any]]] = Field(None, description="Filtros")
    period: Optional[str] = Field(None, description="Periodo: today, week, month, quarter, year")
    compare_previous: Optional[bool] = Field(False, description="Comparar com periodo anterior")

class AnalysisRequest(BaseModel):
    data: List[Dict[str, Any]] = Field(..., description="Dados para analise em formato JSON")
    question: Optional[str] = Field(None, description="Pergunta especifica sobre os dados")

class DatasetRefreshRequest(BaseModel):
    dataset_id: Optional[int] = Field(None, description="ID do dataset")
    sql: Optional[str] = Field(None, description="Query SQL do dataset")
    table: Optional[str] = Field(None, description="Tabela fonte")


def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    raise TypeError(f"Type {type(obj)} not serializable")


def validate_sql(sql: str) -> tuple:
    sql_upper = sql.strip().upper()

    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("WITH"):
        return False, "Somente queries SELECT ou WITH sao permitidas"

    for kw in FORBIDDEN_KEYWORDS:
        pattern = r'\b' + kw + r'\b'
        if re.search(pattern, sql_upper):
            return False, f"Keyword proibida: {kw}"

    for p in FORBIDDEN_PATTERNS:
        if re.search(p, sql, re.IGNORECASE):
            return False, f"Padrao SQL proibido detectado"

    if sql.count(";") > 1:
        return False, "Multiplos statements nao sao permitidos"

    return True, ""


def get_db_connection():
    if not HAS_PSYCOPG2:
        raise HTTPException(status_code=500, detail="psycopg2 nao instalado")
    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL nao configurada")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.set_session(readonly=True, autocommit=True)
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro de conexao: {str(e)}")


def execute_query(sql: str, params: dict = None, limit: int = MAX_ROWS) -> Dict[str, Any]:
    valid, reason = validate_sql(sql)
    if not valid:
        raise HTTPException(status_code=400, detail=reason)

    if "LIMIT" not in sql.upper():
        sql = f"{sql.rstrip(';')} LIMIT {min(limit, MAX_ROWS)}"

    conn = get_db_connection()
    try:
        start = time.time()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(f"SET statement_timeout = '{QUERY_TIMEOUT_MS}';")
        cur.execute(sql, params)
        rows = cur.fetchall()
        elapsed = round((time.time() - start) * 1000, 2)

        columns = []
        if cur.description:
            columns = [{"name": desc[0], "type": str(desc[1])} for desc in cur.description]

        data = json.loads(json.dumps([dict(r) for r in rows], default=json_serial))

        return {
            "data": data,
            "columns": columns,
            "row_count": len(data),
            "elapsed_ms": elapsed,
        }
    except psycopg2.errors.QueryCanceled:
        raise HTTPException(status_code=408, detail=f"Query excedeu timeout de {QUERY_TIMEOUT_MS}ms")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na query: {str(e)}")
    finally:
        conn.close()


def build_chart_query(req: ChartDataRequest) -> str:
    if req.sql:
        return req.sql

    if not req.table:
        raise HTTPException(status_code=400, detail="Informe sql ou table")

    safe_table = re.sub(r'[^a-zA-Z0-9_]', '', req.table)
    safe_x = re.sub(r'[^a-zA-Z0-9_]', '', req.x_axis)
    safe_y = re.sub(r'[^a-zA-Z0-9_]', '', req.y_axis)
    agg = req.aggregation or "sum"
    agg_map = {"sum": "SUM", "avg": "AVG", "count": "COUNT", "min": "MIN", "max": "MAX"}
    agg_fn = agg_map.get(agg, "SUM")

    x_expr = safe_x
    if req.time_grain:
        grain_map = {
            "day": "DATE_TRUNC('day', {})",
            "week": "DATE_TRUNC('week', {})",
            "month": "DATE_TRUNC('month', {})",
            "quarter": "DATE_TRUNC('quarter', {})",
            "year": "DATE_TRUNC('year', {})",
        }
        if req.time_grain in grain_map:
            x_expr = grain_map[req.time_grain].format(safe_x)

    select_parts = [f"{x_expr} AS label"]
    if req.group_by:
        safe_group = re.sub(r'[^a-zA-Z0-9_]', '', req.group_by)
        select_parts.append(f"{safe_group} AS series")
        select_parts.append(f"{agg_fn}({safe_y}) AS value")
        group_clause = f"GROUP BY {x_expr}, {safe_group}"
    else:
        select_parts.append(f"{agg_fn}({safe_y}) AS value")
        group_clause = f"GROUP BY {x_expr}"

    where_parts = []
    if req.filters:
        for f in req.filters:
            col = re.sub(r'[^a-zA-Z0-9_]', '', f.get("column", ""))
            op = f.get("operator", "=")
            val = f.get("value", "")
            if op in ("=", "!=", ">", ">=", "<", "<="):
                if isinstance(val, (int, float)):
                    where_parts.append(f"{col} {op} {val}")
                else:
                    safe_val = str(val).replace("'", "''")
                    where_parts.append(f"{col} {op} '{safe_val}'")
            elif op == "LIKE":
                safe_val = str(val).replace("'", "''")
                where_parts.append(f"{col} LIKE '{safe_val}'")

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    order = f"ORDER BY {req.order_by}" if req.order_by else f"ORDER BY label"
    limit_clause = f"LIMIT {min(req.limit or 100, MAX_ROWS)}"

    query = f"SELECT {', '.join(select_parts)} FROM {safe_table} {where_clause} {group_clause} {order} {limit_clause}"
    return query


def build_period_filter(period: str, date_col: str = "created_at") -> tuple:
    now = datetime.now()
    safe_col = re.sub(r'[^a-zA-Z0-9_]', '', date_col)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start - timedelta(days=1)
        prev_end = start
    elif period == "week":
        start = now - timedelta(days=now.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start - timedelta(weeks=1)
        prev_end = start
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if start.month == 1:
            prev_start = start.replace(year=start.year - 1, month=12)
        else:
            prev_start = start.replace(month=start.month - 1)
        prev_end = start
    elif period == "quarter":
        q_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = start - timedelta(days=90)
        prev_end = start
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = start.replace(year=start.year - 1)
        prev_end = start
    else:
        return "", "", ""

    current_filter = f"{safe_col} >= '{start.isoformat()}'"
    prev_filter = f"{safe_col} >= '{prev_start.isoformat()}' AND {safe_col} < '{prev_end.isoformat()}'"
    return current_filter, prev_filter, safe_col


def analyze_column(df: pd.DataFrame, col: str) -> Dict:
    series = df[col]
    dtype = str(series.dtype)
    stats = {
        "name": col,
        "dtype": dtype,
        "count": int(series.count()),
        "null_count": int(series.isna().sum()),
        "unique_count": int(series.nunique()),
    }
    if pd.api.types.is_numeric_dtype(series):
        stats["min_value"] = float(series.min()) if not pd.isna(series.min()) else None
        stats["max_value"] = float(series.max()) if not pd.isna(series.max()) else None
        stats["mean"] = float(series.mean()) if not pd.isna(series.mean()) else None
        stats["median"] = float(series.median()) if not pd.isna(series.median()) else None
        stats["std"] = float(series.std()) if not pd.isna(series.std()) else None
        stats["sum"] = float(series.sum()) if not pd.isna(series.sum()) else None
    else:
        top = series.value_counts().head(5)
        stats["top_values"] = [{"value": str(k), "count": int(v)} for k, v in top.items()]
    return stats


def generate_insights(df: pd.DataFrame) -> List[str]:
    insights = []
    insights.append(f"O dataset possui {len(df)} registros e {len(df.columns)} colunas.")
    null_pct = (df.isna().sum().sum() / (len(df) * len(df.columns))) * 100
    if null_pct > 0:
        insights.append(f"Taxa de dados faltantes: {null_pct:.1f}%")
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        for col in numeric_cols[:3]:
            series = df[col].dropna()
            if len(series) > 0 and series.mean() != 0:
                cv = (series.std() / series.mean() * 100)
                if cv > 50:
                    insights.append(f"'{col}' tem alta variabilidade (CV: {cv:.1f}%)")
    return insights


def suggest_charts(df: pd.DataFrame) -> List[Dict[str, Any]]:
    suggestions = []
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    date_cols = [c for c in df.columns if 'date' in c.lower() or 'data' in c.lower() or 'created' in c.lower()]
    if cat_cols and numeric_cols:
        suggestions.append({"type": "bar", "title": f"{numeric_cols[0]} por {cat_cols[0]}", "xAxis": cat_cols[0], "yAxis": numeric_cols[0], "aggregation": "sum"})
    if date_cols and numeric_cols:
        suggestions.append({"type": "line", "title": f"Evolucao de {numeric_cols[0]}", "xAxis": date_cols[0], "yAxis": numeric_cols[0], "aggregation": "sum"})
    if cat_cols and numeric_cols and len(df[cat_cols[0]].unique()) <= 8:
        suggestions.append({"type": "pie", "title": f"Proporcao de {numeric_cols[0]} por {cat_cols[0]}", "xAxis": cat_cols[0], "yAxis": numeric_cols[0], "aggregation": "sum"})
    return suggestions


# ==================== ENDPOINTS ====================

@app.get("/health")
async def health_check():
    db_ok = False
    if HAS_PSYCOPG2 and DATABASE_URL:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            conn.close()
            db_ok = True
        except:
            pass
    return {
        "status": "ok",
        "service": "bi-engine",
        "version": "2.0.0",
        "database": "connected" if db_ok else "disconnected",
        "cache": cache.stats(),
        "pandas_version": pd.__version__,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/version")
async def version():
    return {
        "name": "Arcadia BI Engine",
        "version": "2.0.0",
        "capabilities": ["sql_query", "chart_data", "micro_bi", "analysis", "aggregation", "cache"],
    }


@app.get("/metrics")
async def metrics():
    return {
        "cache": cache.stats(),
        "limits": {
            "max_rows": MAX_ROWS,
            "query_timeout_ms": QUERY_TIMEOUT_MS,
            "cache_ttl_seconds": CACHE_TTL_SECONDS,
        },
    }


@app.get("/tables")
async def list_tables():
    result = execute_query("""
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    return {"tables": result["data"]}


@app.get("/tables/{table_name}/columns")
async def table_columns(table_name: str):
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
    result = execute_query(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{safe_name}'
        ORDER BY ordinal_position
    """)
    return {"table": safe_name, "columns": result["data"]}


@app.get("/tables/{table_name}/preview")
async def table_preview(table_name: str, limit: int = Query(default=50, le=500)):
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
    result = execute_query(f"SELECT * FROM {safe_name} LIMIT {limit}")
    return result


@app.get("/tables/{table_name}/stats")
async def table_stats(table_name: str):
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
    count_result = execute_query(f"SELECT COUNT(*) as total FROM {safe_name}")
    cols_result = execute_query(f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{safe_name}'
        ORDER BY ordinal_position
    """)
    return {
        "table": safe_name,
        "row_count": count_result["data"][0]["total"] if count_result["data"] else 0,
        "column_count": len(cols_result["data"]),
        "columns": cols_result["data"],
    }


@app.post("/query")
async def run_query(request: SQLQueryRequest):
    if request.use_cache:
        cached = cache.get(request.sql, request.params)
        if cached:
            return {**cached, "cached": True}

    result = execute_query(request.sql, request.params, request.limit or MAX_ROWS)

    if request.use_cache:
        cache.set(request.sql, result, request.params)

    return {**result, "cached": False}


@app.post("/chart-data")
async def chart_data(request: ChartDataRequest):
    query = build_chart_query(request)

    cached = cache.get(query)
    if cached:
        return {**cached, "cached": True, "query": query}

    result = execute_query(query, limit=request.limit or 100)

    series_data = {}
    for row in result["data"]:
        label = str(row.get("label", ""))
        value = row.get("value", 0)
        series_key = str(row.get("series", "default"))
        if series_key not in series_data:
            series_data[series_key] = []
        series_data[series_key].append({"label": label, "value": value})

    chart_result = {
        "labels": list(set(str(r.get("label", "")) for r in result["data"])),
        "series": series_data,
        "row_count": result["row_count"],
        "elapsed_ms": result["elapsed_ms"],
        "query": query,
    }

    cache.set(query, chart_result)
    return {**chart_result, "cached": False}


@app.post("/micro-bi")
async def micro_bi(request: MicroBIRequest):
    safe_table = re.sub(r'[^a-zA-Z0-9_]', '', request.table)
    results = {}

    where_parts = []
    prev_where_parts = []
    if request.period:
        current_f, prev_f, _ = build_period_filter(request.period)
        if current_f:
            where_parts.append(current_f)
            prev_where_parts.append(prev_f)

    if request.filters:
        for f in request.filters:
            col = re.sub(r'[^a-zA-Z0-9_]', '', f.get("column", ""))
            op = f.get("operator", "=")
            val = f.get("value", "")
            if op in ("=", "!=", ">", ">=", "<", "<="):
                if isinstance(val, (int, float)):
                    clause = f"{col} {op} {val}"
                else:
                    safe_val = str(val).replace("'", "''")
                    clause = f"{col} {op} '{safe_val}'"
                where_parts.append(clause)
                prev_where_parts.append(clause)

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    prev_where_clause = f"WHERE {' AND '.join(prev_where_parts)}" if prev_where_parts else ""

    metric_list = request.metrics or ["count"]
    metric_exprs = []
    for m in metric_list:
        if m == "count":
            metric_exprs.append("COUNT(*) AS count")
        elif m.startswith("sum:"):
            col = re.sub(r'[^a-zA-Z0-9_]', '', m.split(":")[1])
            metric_exprs.append(f"SUM({col}) AS sum_{col}")
        elif m.startswith("avg:"):
            col = re.sub(r'[^a-zA-Z0-9_]', '', m.split(":")[1])
            metric_exprs.append(f"AVG({col}) AS avg_{col}")
        elif m.startswith("min:"):
            col = re.sub(r'[^a-zA-Z0-9_]', '', m.split(":")[1])
            metric_exprs.append(f"MIN({col}) AS min_{col}")
        elif m.startswith("max:"):
            col = re.sub(r'[^a-zA-Z0-9_]', '', m.split(":")[1])
            metric_exprs.append(f"MAX({col}) AS max_{col}")

    if not metric_exprs:
        metric_exprs = ["COUNT(*) AS count"]

    if request.dimension:
        safe_dim = re.sub(r'[^a-zA-Z0-9_]', '', request.dimension)
        query = f"SELECT {safe_dim} AS dimension, {', '.join(metric_exprs)} FROM {safe_table} {where_clause} GROUP BY {safe_dim} ORDER BY {metric_exprs[0].split(' AS ')[1]} DESC LIMIT 20"
    else:
        query = f"SELECT {', '.join(metric_exprs)} FROM {safe_table} {where_clause}"

    result = execute_query(query)
    results["current"] = result["data"]

    if request.compare_previous and request.period and prev_where_parts:
        if request.dimension:
            prev_query = f"SELECT {safe_dim} AS dimension, {', '.join(metric_exprs)} FROM {safe_table} {prev_where_clause} GROUP BY {safe_dim} ORDER BY {metric_exprs[0].split(' AS ')[1]} DESC LIMIT 20"
        else:
            prev_query = f"SELECT {', '.join(metric_exprs)} FROM {safe_table} {prev_where_clause}"
        prev_result = execute_query(prev_query)
        results["previous"] = prev_result["data"]

        if not request.dimension and results["current"] and results["previous"]:
            comparison = {}
            curr = results["current"][0]
            prev = results["previous"][0]
            for key in curr:
                c_val = curr[key] or 0
                p_val = prev.get(key, 0) or 0
                if p_val != 0:
                    change_pct = round(((c_val - p_val) / p_val) * 100, 1)
                else:
                    change_pct = 100 if c_val > 0 else 0
                comparison[key] = {
                    "current": c_val,
                    "previous": p_val,
                    "change": round(c_val - p_val, 2),
                    "change_pct": change_pct,
                    "trend": "up" if c_val > p_val else "down" if c_val < p_val else "stable",
                }
            results["comparison"] = comparison

    return {
        "table": safe_table,
        "period": request.period,
        "metrics": metric_list,
        "dimension": request.dimension,
        **results,
    }


@app.post("/analyze")
async def analyze_data(request: AnalysisRequest):
    try:
        if not request.data or len(request.data) == 0:
            raise HTTPException(status_code=400, detail="Dados vazios")
        df = pd.DataFrame(request.data)
        columns_stats = [analyze_column(df, col) for col in df.columns]
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        numeric_summary = {}
        if numeric_cols:
            desc = df[numeric_cols].describe()
            numeric_summary = {"columns": numeric_cols, "statistics": desc.to_dict()}
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        categorical_summary = {}
        if cat_cols:
            for col in cat_cols[:5]:
                vc = df[col].value_counts().head(10)
                categorical_summary[col] = {
                    "unique_count": int(df[col].nunique()),
                    "top_values": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
                }
        correlations = None
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr()
            correlations = {col: {k: round(float(v), 3) for k, v in corr_matrix[col].items()} for col in numeric_cols}
        insights = generate_insights(df)
        suggested = suggest_charts(df)
        return {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": columns_stats,
            "numeric_summary": numeric_summary,
            "categorical_summary": categorical_summary,
            "correlations": correlations,
            "insights": insights,
            "suggested_charts": suggested,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na analise: {str(e)}")


@app.post("/aggregate")
async def aggregate_data(request: dict):
    try:
        data = request.get("data", [])
        group_by = request.get("group_by", "")
        agg_column = request.get("agg_column", "")
        agg_function = request.get("agg_function", "sum")
        if not data:
            raise HTTPException(status_code=400, detail="Dados vazios")
        df = pd.DataFrame(data)
        if group_by not in df.columns:
            raise HTTPException(status_code=400, detail=f"Coluna '{group_by}' nao encontrada")
        if agg_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Coluna '{agg_column}' nao encontrada")
        result = df.groupby(group_by)[agg_column].agg(agg_function).reset_index()
        result.columns = [group_by, agg_column]
        return {"data": result.to_dict(orient="records"), "aggregation": {"group_by": group_by, "column": agg_column, "function": agg_function}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na agregacao: {str(e)}")


@app.post("/cache/invalidate")
async def invalidate_cache(pattern: Optional[str] = None):
    cache.invalidate(pattern)
    return {"success": True, "message": "Cache invalidado"}


@app.get("/cache/stats")
async def cache_stats():
    return cache.stats()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("BI_PORT", os.environ.get("BI_ENGINE_PORT", "8004")))
    print(f"[BI Engine] Iniciando na porta {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
