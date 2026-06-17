"""
Arcadia Automation Engine - Motor de Automacao
Servico FastAPI que gerencia scheduler, event bus, workflow execution,
e fornece compute para o modulo de automacoes.

Porta padrao: 8005
"""

import os
import json
import time
import re
import threading
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

app = FastAPI(
    title="Arcadia Automation Engine",
    description="Motor de Automacao - Scheduler, Event Bus, Workflow Executor",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")


class EventType(str, Enum):
    RECORD_CREATED = "record.created"
    RECORD_UPDATED = "record.updated"
    RECORD_DELETED = "record.deleted"
    SCHEDULE_FIRED = "schedule.fired"
    WEBHOOK_RECEIVED = "webhook.received"
    THRESHOLD_REACHED = "threshold.reached"
    AGENT_COMPLETED = "agent.completed"
    MANUAL_TRIGGER = "manual.trigger"
    SYSTEM_EVENT = "system.event"


class WorkflowStepType(str, Enum):
    CONDITION = "condition"
    ACTION = "action"
    DELAY = "delay"
    LOOP = "loop"
    PARALLEL = "parallel"
    SQL_QUERY = "query"
    HTTP_REQUEST = "http"
    TRANSFORM = "transform"
    NOTIFY = "notify"


class CronExpression:
    def __init__(self, expr: str):
        self.expr = expr.strip()
        self.parts = self.expr.split()
        if len(self.parts) != 5:
            raise ValueError(f"Cron expression deve ter 5 partes: {expr}")

    def _match_part(self, part: str, value: int, max_val: int) -> bool:
        if part == "*":
            return True
        for item in part.split(","):
            if "/" in item:
                base, step = item.split("/")
                base_val = 0 if base == "*" else int(base)
                step_val = int(step)
                if (value - base_val) % step_val == 0 and value >= base_val:
                    return True
            elif "-" in item:
                low, high = item.split("-")
                if int(low) <= value <= int(high):
                    return True
            else:
                if int(item) == value:
                    return True
        return False

    def matches(self, dt: datetime) -> bool:
        return (
            self._match_part(self.parts[0], dt.minute, 59) and
            self._match_part(self.parts[1], dt.hour, 23) and
            self._match_part(self.parts[2], dt.day, 31) and
            self._match_part(self.parts[3], dt.month, 12) and
            self._match_part(self.parts[4], dt.weekday(), 6)
        )

    def next_run(self, from_dt: datetime = None) -> datetime:
        dt = from_dt or datetime.now()
        dt = dt.replace(second=0, microsecond=0) + timedelta(minutes=1)
        for _ in range(525960):
            if self.matches(dt):
                return dt
            dt += timedelta(minutes=1)
        return dt


class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Dict]] = defaultdict(list)
        self._event_history: List[Dict] = []
        self._max_history = 500

    def subscribe(self, event_type: str, handler_id: str, config: Dict = None):
        self._subscribers[event_type].append({
            "handler_id": handler_id,
            "config": config or {},
            "subscribed_at": datetime.now().isoformat(),
        })

    def unsubscribe(self, event_type: str, handler_id: str):
        self._subscribers[event_type] = [
            s for s in self._subscribers[event_type] if s["handler_id"] != handler_id
        ]

    def emit(self, event_type: str, payload: Dict = None) -> List[str]:
        event = {
            "type": event_type,
            "payload": payload or {},
            "timestamp": datetime.now().isoformat(),
            "id": hashlib.sha256(f"{event_type}:{time.time()}".encode()).hexdigest()[:16],
        }
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]

        triggered = []
        for sub in self._subscribers.get(event_type, []):
            triggered.append(sub["handler_id"])
        for sub in self._subscribers.get("*", []):
            triggered.append(sub["handler_id"])
        return triggered

    def get_subscribers(self, event_type: str = None) -> Dict:
        if event_type:
            return {event_type: self._subscribers.get(event_type, [])}
        return dict(self._subscribers)

    def get_history(self, limit: int = 50, event_type: str = None) -> List[Dict]:
        history = self._event_history
        if event_type:
            history = [e for e in history if e["type"] == event_type]
        return history[-limit:]

    def stats(self) -> Dict:
        return {
            "total_event_types": len(self._subscribers),
            "total_subscribers": sum(len(v) for v in self._subscribers.values()),
            "history_size": len(self._event_history),
            "event_types": list(self._subscribers.keys()),
        }


class SchedulerEntry(BaseModel):
    id: str
    name: str
    cron: str
    automation_id: Optional[int] = None
    action: str = "trigger"
    config: Optional[Dict] = None
    is_active: bool = True
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    run_count: int = 0


class Scheduler:
    def __init__(self):
        self._entries: Dict[str, SchedulerEntry] = {}
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._check_interval = 30

    def add(self, entry: SchedulerEntry):
        try:
            cron = CronExpression(entry.cron)
            entry.next_run = cron.next_run().isoformat()
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        self._entries[entry.id] = entry

    def remove(self, entry_id: str):
        self._entries.pop(entry_id, None)

    def get(self, entry_id: str) -> Optional[SchedulerEntry]:
        return self._entries.get(entry_id)

    def list_all(self) -> List[SchedulerEntry]:
        return list(self._entries.values())

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def _run_loop(self):
        while self._running:
            now = datetime.now()
            for entry_id, entry in list(self._entries.items()):
                if not entry.is_active:
                    continue
                try:
                    cron = CronExpression(entry.cron)
                    if cron.matches(now):
                        entry.last_run = now.isoformat()
                        entry.run_count += 1
                        entry.next_run = cron.next_run(now).isoformat()
                        event_bus.emit(EventType.SCHEDULE_FIRED, {
                            "scheduler_id": entry.id,
                            "automation_id": entry.automation_id,
                            "name": entry.name,
                        })
                except Exception as e:
                    print(f"[Scheduler] Error checking {entry_id}: {e}")
            time.sleep(self._check_interval)

    def stats(self) -> Dict:
        active = sum(1 for e in self._entries.values() if e.is_active)
        return {
            "total_entries": len(self._entries),
            "active_entries": active,
            "is_running": self._running,
            "check_interval_seconds": self._check_interval,
        }


class WorkflowStep(BaseModel):
    id: str
    type: str
    config: Dict = {}
    on_success: Optional[str] = None
    on_failure: Optional[str] = None


class WorkflowDefinition(BaseModel):
    id: str
    name: str
    steps: List[WorkflowStep]
    trigger: Optional[str] = None
    variables: Optional[Dict] = None


class WorkflowExecution(BaseModel):
    workflow_id: str
    trigger_data: Optional[Dict] = None
    variables: Optional[Dict] = None


class WorkflowExecutor:
    def __init__(self):
        self._workflows: Dict[str, WorkflowDefinition] = {}
        self._executions: List[Dict] = []
        self._max_executions = 200

    def register(self, workflow: WorkflowDefinition):
        self._workflows[workflow.id] = workflow

    def unregister(self, workflow_id: str):
        self._workflows.pop(workflow_id, None)

    def get(self, workflow_id: str) -> Optional[WorkflowDefinition]:
        return self._workflows.get(workflow_id)

    def list_all(self) -> List[WorkflowDefinition]:
        return list(self._workflows.values())

    def execute(self, workflow_id: str, trigger_data: Dict = None, variables: Dict = None) -> Dict:
        workflow = self._workflows.get(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' nao encontrado")

        exec_id = hashlib.sha256(f"{workflow_id}:{time.time()}".encode()).hexdigest()[:16]
        execution = {
            "id": exec_id,
            "workflow_id": workflow_id,
            "workflow_name": workflow.name,
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "completed_at": None,
            "steps_completed": 0,
            "steps_total": len(workflow.steps),
            "results": [],
            "error": None,
            "variables": {**(workflow.variables or {}), **(variables or {}), **(trigger_data or {})},
        }

        try:
            for i, step in enumerate(workflow.steps):
                step_result = self._execute_step(step, execution["variables"])
                execution["results"].append({
                    "step_id": step.id,
                    "type": step.type,
                    "status": "completed",
                    "result": step_result,
                    "executed_at": datetime.now().isoformat(),
                })
                execution["steps_completed"] = i + 1

                if isinstance(step_result, dict):
                    execution["variables"].update(step_result.get("output", {}))

            execution["status"] = "completed"
            execution["completed_at"] = datetime.now().isoformat()
        except Exception as e:
            execution["status"] = "error"
            execution["error"] = str(e)
            execution["completed_at"] = datetime.now().isoformat()

        self._executions.append(execution)
        if len(self._executions) > self._max_executions:
            self._executions = self._executions[-self._max_executions:]

        return execution

    def _execute_step(self, step: WorkflowStep, variables: Dict) -> Any:
        if step.type == WorkflowStepType.CONDITION:
            return self._exec_condition(step.config, variables)
        elif step.type == WorkflowStepType.ACTION:
            return self._exec_action(step.config, variables)
        elif step.type == WorkflowStepType.DELAY:
            delay_seconds = step.config.get("seconds", 1)
            time.sleep(min(delay_seconds, 30))
            return {"delayed": delay_seconds}
        elif step.type == WorkflowStepType.SQL_QUERY:
            return self._exec_query(step.config, variables)
        elif step.type == WorkflowStepType.HTTP_REQUEST:
            return self._exec_http(step.config, variables)
        elif step.type == WorkflowStepType.TRANSFORM:
            return self._exec_transform(step.config, variables)
        elif step.type == WorkflowStepType.NOTIFY:
            return {"notified": True, "message": step.config.get("message", ""), "channel": step.config.get("channel", "system")}
        else:
            return {"type": step.type, "status": "unknown_step_type"}

    def _exec_condition(self, config: Dict, variables: Dict) -> Dict:
        field = config.get("field", "")
        operator = config.get("operator", "==")
        value = config.get("value")
        actual = variables.get(field)
        ops = {
            "==": lambda a, b: a == b,
            "!=": lambda a, b: a != b,
            ">": lambda a, b: float(a) > float(b),
            "<": lambda a, b: float(a) < float(b),
            ">=": lambda a, b: float(a) >= float(b),
            "<=": lambda a, b: float(a) <= float(b),
            "contains": lambda a, b: str(b) in str(a),
            "exists": lambda a, b: a is not None,
        }
        op_fn = ops.get(operator, ops["=="])
        try:
            result = op_fn(actual, value)
        except:
            result = False
        return {"condition": True, "result": result, "field": field, "operator": operator}

    def _exec_action(self, config: Dict, variables: Dict) -> Dict:
        action_type = config.get("type", "log")
        if action_type == "log":
            return {"action": "log", "message": config.get("message", "")}
        elif action_type == "set_variable":
            key = config.get("key", "")
            val = config.get("value", "")
            return {"action": "set_variable", "output": {key: val}}
        elif action_type == "emit_event":
            event_type = config.get("event_type", "custom.event")
            event_bus.emit(event_type, config.get("payload", {}))
            return {"action": "emit_event", "event_type": event_type}
        return {"action": action_type, "status": "executed"}

    def _exec_query(self, config: Dict, variables: Dict) -> Dict:
        if not HAS_PSYCOPG2 or not DATABASE_URL:
            return {"error": "Database nao disponivel"}
        sql = config.get("sql", "")
        if not sql.strip().upper().startswith("SELECT"):
            return {"error": "Somente SELECT permitido"}
        try:
            conn = psycopg2.connect(DATABASE_URL)
            conn.set_session(readonly=True, autocommit=True)
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(f"SET statement_timeout = '10000';")
            cur.execute(sql)
            rows = cur.fetchall()
            conn.close()
            data = [dict(r) for r in rows[:100]]
            return {"query": "executed", "row_count": len(data), "output": {"query_result": data}}
        except Exception as e:
            return {"error": f"Query falhou: {str(e)}"}

    def _exec_http(self, config: Dict, variables: Dict) -> Dict:
        import urllib.request
        url = config.get("url", "")
        method = config.get("method", "GET").upper()
        if not url:
            return {"error": "URL nao informada"}
        try:
            req = urllib.request.Request(url, method=method)
            req.add_header("Content-Type", "application/json")
            if config.get("body"):
                body = json.dumps(config["body"]).encode()
                req.data = body
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"status": resp.status, "output": {"http_response": resp.read().decode()[:5000]}}
        except Exception as e:
            return {"error": f"HTTP falhou: {str(e)}"}

    def _exec_transform(self, config: Dict, variables: Dict) -> Dict:
        operation = config.get("operation", "map")
        source = config.get("source", "")
        data = variables.get(source, [])
        if operation == "count":
            return {"output": {"count": len(data) if isinstance(data, list) else 1}}
        elif operation == "sum" and isinstance(data, list):
            field = config.get("field", "")
            total = sum(float(item.get(field, 0)) for item in data if isinstance(item, dict))
            return {"output": {"sum": total}}
        elif operation == "filter" and isinstance(data, list):
            field = config.get("field", "")
            value = config.get("value")
            filtered = [item for item in data if isinstance(item, dict) and item.get(field) == value]
            return {"output": {"filtered": filtered}}
        return {"output": {}}

    def get_executions(self, workflow_id: str = None, limit: int = 50) -> List[Dict]:
        execs = self._executions
        if workflow_id:
            execs = [e for e in execs if e["workflow_id"] == workflow_id]
        return execs[-limit:]

    def stats(self) -> Dict:
        total = len(self._executions)
        completed = sum(1 for e in self._executions if e["status"] == "completed")
        errors = sum(1 for e in self._executions if e["status"] == "error")
        return {
            "total_workflows": len(self._workflows),
            "total_executions": total,
            "completed": completed,
            "errors": errors,
            "success_rate": round(completed / total * 100, 1) if total > 0 else 0,
        }


event_bus = EventBus()
scheduler = Scheduler()
workflow_executor = WorkflowExecutor()


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
        "service": "automation-engine",
        "version": "1.0.0",
        "database": "connected" if db_ok else "disconnected",
        "scheduler": scheduler.stats(),
        "event_bus": event_bus.stats(),
        "workflows": workflow_executor.stats(),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/version")
async def version():
    return {
        "name": "Arcadia Automation Engine",
        "version": "1.0.0",
        "capabilities": ["scheduler", "event_bus", "workflow_executor", "cron", "http_actions", "sql_queries"],
    }


@app.get("/metrics")
async def metrics():
    return {
        "scheduler": scheduler.stats(),
        "event_bus": event_bus.stats(),
        "workflows": workflow_executor.stats(),
    }


# --- Scheduler endpoints ---

@app.get("/scheduler/entries")
async def list_scheduler_entries():
    return {"entries": [e.dict() for e in scheduler.list_all()]}


@app.post("/scheduler/entries")
async def add_scheduler_entry(entry: SchedulerEntry):
    scheduler.add(entry)
    return {"success": True, "entry": entry.dict()}


@app.delete("/scheduler/entries/{entry_id}")
async def remove_scheduler_entry(entry_id: str):
    scheduler.remove(entry_id)
    return {"success": True}


@app.post("/scheduler/start")
async def start_scheduler():
    scheduler.start()
    return {"success": True, "message": "Scheduler iniciado"}


@app.post("/scheduler/stop")
async def stop_scheduler():
    scheduler.stop()
    return {"success": True, "message": "Scheduler parado"}


@app.get("/scheduler/stats")
async def scheduler_stats():
    return scheduler.stats()


# --- Event Bus endpoints ---

@app.post("/events/emit")
async def emit_event(event_type: str, payload: Dict = None):
    triggered = event_bus.emit(event_type, payload or {})
    return {"success": True, "event_type": event_type, "triggered_handlers": triggered}


@app.post("/events/subscribe")
async def subscribe_event(event_type: str, handler_id: str, config: Dict = None):
    event_bus.subscribe(event_type, handler_id, config)
    return {"success": True, "event_type": event_type, "handler_id": handler_id}


@app.post("/events/unsubscribe")
async def unsubscribe_event(event_type: str, handler_id: str):
    event_bus.unsubscribe(event_type, handler_id)
    return {"success": True}


@app.get("/events/subscribers")
async def list_subscribers(event_type: Optional[str] = None):
    return event_bus.get_subscribers(event_type)


@app.get("/events/history")
async def event_history(limit: int = 50, event_type: Optional[str] = None):
    return {"events": event_bus.get_history(limit, event_type)}


@app.get("/events/stats")
async def event_stats():
    return event_bus.stats()


@app.get("/events/types")
async def event_types():
    return {"types": [e.value for e in EventType]}


# --- Workflow endpoints ---

@app.post("/workflows/register")
async def register_workflow(workflow: WorkflowDefinition):
    workflow_executor.register(workflow)
    return {"success": True, "workflow_id": workflow.id}


@app.delete("/workflows/{workflow_id}")
async def unregister_workflow(workflow_id: str):
    workflow_executor.unregister(workflow_id)
    return {"success": True}


@app.get("/workflows")
async def list_workflows():
    return {"workflows": [w.dict() for w in workflow_executor.list_all()]}


@app.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    w = workflow_executor.get(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow nao encontrado")
    return w.dict()


@app.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, execution: WorkflowExecution = None):
    trigger_data = execution.trigger_data if execution else None
    variables = execution.variables if execution else None
    result = workflow_executor.execute(workflow_id, trigger_data, variables)
    return result


@app.get("/workflows/{workflow_id}/executions")
async def workflow_executions(workflow_id: str, limit: int = 50):
    return {"executions": workflow_executor.get_executions(workflow_id, limit)}


@app.get("/executions")
async def all_executions(limit: int = 50):
    return {"executions": workflow_executor.get_executions(limit=limit)}


@app.get("/workflows/stats")
async def workflow_stats_endpoint():
    return workflow_executor.stats()


# --- Cron helper ---

@app.post("/cron/validate")
async def validate_cron(expression: str):
    try:
        cron = CronExpression(expression)
        next_runs = []
        dt = datetime.now()
        for _ in range(5):
            dt = cron.next_run(dt)
            next_runs.append(dt.isoformat())
            dt += timedelta(minutes=1)
        return {"valid": True, "expression": expression, "next_runs": next_runs}
    except ValueError as e:
        return {"valid": False, "expression": expression, "error": str(e)}


@app.on_event("startup")
async def startup():
    scheduler.start()
    print("[Automation Engine] Scheduler iniciado automaticamente")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AUTOMATION_PORT", os.environ.get("AUTOMATION_ENGINE_PORT", "8005")))
    print(f"[Automation Engine] Iniciando na porta {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
