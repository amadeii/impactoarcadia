"""
Arcádia BI Analysis Service - Análise de dados com Pandas
Serviço FastAPI que processa dados com pandas para fornecer estatísticas avançadas
"""

import os
import json
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pandas as pd
import numpy as np

app = FastAPI(
    title="Arcádia BI Analysis Service",
    description="Análise de dados com Pandas para o módulo de BI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    data: List[Dict[str, Any]] = Field(..., description="Dados para análise em formato JSON")
    question: Optional[str] = Field(None, description="Pergunta específica sobre os dados")


class ColumnStats(BaseModel):
    name: str
    dtype: str
    count: int
    null_count: int
    unique_count: int
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    sum: Optional[float] = None
    top_values: Optional[List[Dict[str, Any]]] = None


class AnalysisResult(BaseModel):
    row_count: int
    column_count: int
    columns: List[ColumnStats]
    numeric_summary: Dict[str, Any]
    categorical_summary: Dict[str, Any]
    correlations: Optional[Dict[str, Dict[str, float]]] = None
    insights: List[str]
    suggested_charts: List[Dict[str, Any]]


def analyze_column(df: pd.DataFrame, col: str) -> ColumnStats:
    """Analisa uma coluna e retorna estatísticas"""
    series = df[col]
    dtype = str(series.dtype)
    
    stats = ColumnStats(
        name=col,
        dtype=dtype,
        count=int(series.count()),
        null_count=int(series.isna().sum()),
        unique_count=int(series.nunique())
    )
    
    if pd.api.types.is_numeric_dtype(series):
        stats.min_value = float(series.min()) if not pd.isna(series.min()) else None
        stats.max_value = float(series.max()) if not pd.isna(series.max()) else None
        stats.mean = float(series.mean()) if not pd.isna(series.mean()) else None
        stats.median = float(series.median()) if not pd.isna(series.median()) else None
        stats.std = float(series.std()) if not pd.isna(series.std()) else None
        stats.sum = float(series.sum()) if not pd.isna(series.sum()) else None
    else:
        top = series.value_counts().head(5)
        stats.top_values = [{"value": str(k), "count": int(v)} for k, v in top.items()]
        if series.dtype == 'object':
            try:
                stats.min_value = str(series.min())
                stats.max_value = str(series.max())
            except:
                pass
    
    return stats


def generate_insights(df: pd.DataFrame) -> List[str]:
    """Gera insights automáticos sobre os dados"""
    insights = []
    
    insights.append(f"O dataset possui {len(df)} registros e {len(df.columns)} colunas.")
    
    null_pct = (df.isna().sum().sum() / (len(df) * len(df.columns))) * 100
    if null_pct > 0:
        insights.append(f"Taxa de dados faltantes: {null_pct:.1f}%")
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        insights.append(f"Colunas numéricas: {', '.join(numeric_cols)}")
        
        for col in numeric_cols[:3]:
            series = df[col].dropna()
            if len(series) > 0:
                cv = (series.std() / series.mean() * 100) if series.mean() != 0 else 0
                if cv > 50:
                    insights.append(f"'{col}' tem alta variabilidade (CV: {cv:.1f}%)")
                
                q1, q3 = series.quantile([0.25, 0.75])
                iqr = q3 - q1
                outliers = ((series < q1 - 1.5*iqr) | (series > q3 + 1.5*iqr)).sum()
                if outliers > 0:
                    insights.append(f"'{col}' possui {outliers} outliers potenciais")
    
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    if cat_cols:
        insights.append(f"Colunas categóricas: {', '.join(cat_cols)}")
        
        for col in cat_cols[:2]:
            unique_pct = df[col].nunique() / len(df) * 100
            if unique_pct > 90:
                insights.append(f"'{col}' parece ser um identificador único ({unique_pct:.0f}% valores únicos)")
    
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr()
        for i, col1 in enumerate(numeric_cols):
            for col2 in numeric_cols[i+1:]:
                corr = corr_matrix.loc[col1, col2]
                if abs(corr) > 0.7:
                    direction = "positiva" if corr > 0 else "negativa"
                    insights.append(f"Correlação {direction} forte entre '{col1}' e '{col2}' ({corr:.2f})")
    
    return insights


def suggest_charts(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Sugere gráficos apropriados para os dados"""
    suggestions = []
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    date_cols = [col for col in df.columns if 'date' in col.lower() or 'data' in col.lower()]
    
    if cat_cols and numeric_cols:
        suggestions.append({
            "type": "bar",
            "title": f"Distribuição de {numeric_cols[0]} por {cat_cols[0]}",
            "xAxis": cat_cols[0],
            "yAxis": numeric_cols[0],
            "aggregation": "sum"
        })
    
    if date_cols and numeric_cols:
        suggestions.append({
            "type": "line",
            "title": f"Evolução de {numeric_cols[0]} ao longo do tempo",
            "xAxis": date_cols[0],
            "yAxis": numeric_cols[0],
            "aggregation": "sum"
        })
    
    if cat_cols and numeric_cols:
        cat_col = cat_cols[0]
        if df[cat_col].nunique() <= 8:
            suggestions.append({
                "type": "pie",
                "title": f"Proporção de {numeric_cols[0]} por {cat_col}",
                "xAxis": cat_col,
                "yAxis": numeric_cols[0],
                "aggregation": "sum"
            })
    
    if len(numeric_cols) >= 2:
        suggestions.append({
            "type": "scatter",
            "title": f"Correlação entre {numeric_cols[0]} e {numeric_cols[1]}",
            "xAxis": numeric_cols[0],
            "yAxis": numeric_cols[1],
            "aggregation": "none"
        })
    
    return suggestions


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "bi-analysis", "pandas_version": pd.__version__}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze_data(request: AnalysisRequest):
    """Analisa um conjunto de dados com pandas"""
    try:
        if not request.data or len(request.data) == 0:
            raise HTTPException(status_code=400, detail="Dados vazios")
        
        df = pd.DataFrame(request.data)
        
        columns_stats = [analyze_column(df, col) for col in df.columns]
        
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        numeric_summary = {}
        if numeric_cols:
            desc = df[numeric_cols].describe()
            numeric_summary = {
                "columns": numeric_cols,
                "statistics": desc.to_dict()
            }
        
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        categorical_summary = {}
        if cat_cols:
            cat_stats = {}
            for col in cat_cols[:5]:
                value_counts = df[col].value_counts().head(10)
                cat_stats[col] = {
                    "unique_count": int(df[col].nunique()),
                    "top_values": [{"value": str(k), "count": int(v)} for k, v in value_counts.items()]
                }
            categorical_summary = cat_stats
        
        correlations = None
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr()
            correlations = {}
            for col in numeric_cols:
                correlations[col] = {k: round(float(v), 3) for k, v in corr_matrix[col].items()}
        
        insights = generate_insights(df)
        suggested_charts = suggest_charts(df)
        
        return AnalysisResult(
            row_count=len(df),
            column_count=len(df.columns),
            columns=columns_stats,
            numeric_summary=numeric_summary,
            categorical_summary=categorical_summary,
            correlations=correlations,
            insights=insights,
            suggested_charts=suggested_charts
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na análise: {str(e)}")


@app.post("/aggregate")
async def aggregate_data(
    data: List[Dict[str, Any]],
    group_by: str,
    agg_column: str,
    agg_function: str = "sum"
):
    """Agrega dados por uma coluna"""
    try:
        df = pd.DataFrame(data)
        
        if group_by not in df.columns:
            raise HTTPException(status_code=400, detail=f"Coluna '{group_by}' não encontrada")
        if agg_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Coluna '{agg_column}' não encontrada")
        
        agg_funcs = {
            "sum": "sum",
            "mean": "mean",
            "count": "count",
            "min": "min",
            "max": "max",
            "median": "median",
            "std": "std"
        }
        
        if agg_function not in agg_funcs:
            raise HTTPException(status_code=400, detail=f"Função de agregação inválida. Use: {list(agg_funcs.keys())}")
        
        result = df.groupby(group_by)[agg_column].agg(agg_funcs[agg_function]).reset_index()
        result.columns = [group_by, agg_column]
        
        return {
            "data": result.to_dict(orient="records"),
            "aggregation": {
                "group_by": group_by,
                "column": agg_column,
                "function": agg_function
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na agregação: {str(e)}")


@app.post("/filter")
async def filter_data(
    data: List[Dict[str, Any]],
    column: str,
    operator: str,
    value: Any
):
    """Filtra dados por uma condição"""
    try:
        df = pd.DataFrame(data)
        
        if column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Coluna '{column}' não encontrada")
        
        ops = {
            "eq": lambda x, v: x == v,
            "ne": lambda x, v: x != v,
            "gt": lambda x, v: x > v,
            "gte": lambda x, v: x >= v,
            "lt": lambda x, v: x < v,
            "lte": lambda x, v: x <= v,
            "contains": lambda x, v: x.str.contains(str(v), case=False, na=False),
            "startswith": lambda x, v: x.str.startswith(str(v), na=False),
            "endswith": lambda x, v: x.str.endswith(str(v), na=False)
        }
        
        if operator not in ops:
            raise HTTPException(status_code=400, detail=f"Operador inválido. Use: {list(ops.keys())}")
        
        mask = ops[operator](df[column], value)
        result = df[mask]
        
        return {
            "data": result.to_dict(orient="records"),
            "filter": {
                "column": column,
                "operator": operator,
                "value": value
            },
            "original_count": len(df),
            "filtered_count": len(result)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no filtro: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("BI_ANALYSIS_PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)
