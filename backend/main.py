"""
Mailair FastAPI application entry point.
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import settings
from limiter import limiter
from routes import auth, emails, actions, replies, integrations, settings as settings_routes, billing, contacts, outlook, calendar, teams, webhooks as webhooks_routes, autoassign, crm_integrations, admin as admin_routes, waitlist as waitlist_routes, push as push_routes, scheduled as scheduled_routes, newsletter as newsletter_routes, relationships as relationships_routes, revenue as revenue_routes, sla as sla_routes, sequences as sequences_routes, knowledge as knowledge_routes, briefs as briefs_routes, quotes as quotes_routes, shop as shop_routes, public as public_routes, touchpoints as touchpoints_routes, workspace as workspace_routes, notifications as notifications_routes, cron as cron_routes, calls as calls_routes, campaigns as campaigns_routes
from workers.email_listener import start_email_listener, stop_email_listener

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown hooks."""
    logger.info("Mailair backend starting up (env=%s).", settings.ENVIRONMENT)
    start_email_listener()

    yield

    logger.info("Mailair backend shutting down.")
    stop_email_listener()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Mailair API",
    description="AI-powered email management SaaS backend.",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Build allowed origins: start from CORS_ORIGINS, then always add
# FRONTEND_URL and the production domain so a missing/wrong env var
# in Render never causes a CORS block.
_ALWAYS_ALLOWED = [
    "https://mailair.company",
    "https://www.mailair.company",
]
_allowed_origins = list(settings.CORS_ORIGINS)
if settings.FRONTEND_URL:
    _fe = settings.FRONTEND_URL.rstrip("/")
    for _origin in [_fe, _fe.replace("https://", "https://www.", 1)]:
        if _origin not in _allowed_origins:
            _allowed_origins.append(_origin)
for _origin in _ALWAYS_ALLOWED:
    if _origin not in _allowed_origins:
        _allowed_origins.append(_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    """Log request timing for observability."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    logger.debug(
        "%s %s → %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
    )
    response.headers["X-Process-Time-Ms"] = f"{elapsed:.1f}"
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return structured 422 errors with human-readable detail."""
    errors = []
    for err in exc.errors():
        errors.append(
            {
                "field": " → ".join(str(loc) for loc in err["loc"]),
                "message": err["msg"],
                "type": err["type"],
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all handler — prevents leaking stack traces in production."""
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    if settings.ENVIRONMENT == "development":
        detail = str(exc)
    else:
        detail = "An unexpected error occurred. Please try again."

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(auth.router, prefix="/api")
app.include_router(emails.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(replies.router, prefix="/api")
app.include_router(integrations.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(outlook.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(teams.router, prefix="/api")
app.include_router(webhooks_routes.router, prefix="/api")
app.include_router(autoassign.router, prefix="/api")
app.include_router(crm_integrations.router, prefix="/api")
app.include_router(admin_routes.router, prefix="/api")
app.include_router(waitlist_routes.router)
app.include_router(public_routes.router)
app.include_router(touchpoints_routes.router, prefix="/api")
app.include_router(workspace_routes.router, prefix="/api")
app.include_router(notifications_routes.router, prefix="/api")
app.include_router(cron_routes.router, prefix="/api")
app.include_router(push_routes.router, prefix="/api")
app.include_router(scheduled_routes.router, prefix="/api")
app.include_router(newsletter_routes.router, prefix="/api")
app.include_router(relationships_routes.router, prefix="/api")
app.include_router(revenue_routes.router, prefix="/api")
app.include_router(sla_routes.router, prefix="/api")
app.include_router(sequences_routes.router, prefix="/api")
app.include_router(knowledge_routes.router, prefix="/api")
app.include_router(briefs_routes.router, prefix="/api")
app.include_router(quotes_routes.router, prefix="/api")
app.include_router(shop_routes.router, prefix="/api")
app.include_router(calls_routes.router, prefix="/api")
app.include_router(campaigns_routes.router, prefix="/api")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"], include_in_schema=False)
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok", "environment": settings.ENVIRONMENT}


@app.get("/", include_in_schema=False)
async def root():
    return {"message": "Mailair API is running.", "docs": "/docs"}
