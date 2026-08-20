import logging
from functools import lru_cache
from supabase import create_client, Client
from config import settings

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Return the singleton Supabase service-role client."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
        logger.info("Supabase client initialised.")
    return _supabase_client


async def keep_supabase_alive() -> None:
    """
    Free/low-tier Supabase projects auto-pause after 7 days with no
    database activity. A trivial read every few days keeps it active
    regardless of whether any user activity happens to touch the DB in
    that window (see APScheduler job "supabase_keepalive").
    """
    try:
        get_supabase().table("user_profiles").select("id").limit(1).execute()
        logger.info("Supabase keep-alive ping succeeded.")
    except Exception as exc:
        logger.error("Supabase keep-alive ping failed: %s", exc)


# ---------------------------------------------------------------------------
# pgvector helpers
# ---------------------------------------------------------------------------

async def store_embedding(
    table: str,
    record: dict,
) -> dict | None:
    """
    Insert a row that contains a pgvector 'embedding' column.

    Parameters
    ----------
    table:  Supabase table name, e.g. ``"reply_embeddings"``
    record: Dict that must include an ``"embedding"`` key whose value is a
            ``list[float]``.  All other keys become regular columns.

    Returns
    -------
    The inserted row, or ``None`` on error.
    """
    try:
        supabase = get_supabase()
        result = supabase.table(table).insert(record).execute()
        return result.data[0] if result.data else None
    except Exception as exc:
        logger.error("store_embedding error (table=%s): %s", table, exc)
        return None


async def query_similar_embeddings(
    rpc_function: str,
    query_embedding: list[float],
    extra_params: dict | None = None,
) -> list[dict]:
    """
    Call a Supabase RPC function that performs pgvector similarity search.

    Parameters
    ----------
    rpc_function:    Name of the SQL function, e.g. ``"match_reply_embeddings"``.
    query_embedding: The query vector as a list of floats.
    extra_params:    Additional named parameters forwarded to the RPC call.

    Returns
    -------
    List of matching rows returned by the RPC function.
    """
    try:
        supabase = get_supabase()
        params = {"query_embedding": query_embedding, **(extra_params or {})}
        result = supabase.rpc(rpc_function, params).execute()
        return result.data or []
    except Exception as exc:
        logger.error("query_similar_embeddings error (fn=%s): %s", rpc_function, exc)
        return []
