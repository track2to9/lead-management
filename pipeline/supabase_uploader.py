"""
Supabase Uploader — persist pipeline results to the database.

Uploads prospects + evidence items collected by the pipeline to Supabase,
including screenshot files to Supabase Storage and metadata rows to the
`evidence` table.  Also supports writing pattern-analysis results to the
`feedback` table so the portal can read them.

Environment variables required:
  NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY  — Service-role key (bypasses RLS)
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

def _get_client():
    """Return an initialised Supabase client or raise if env vars are missing."""
    try:
        from supabase import create_client  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "supabase package is not installed. "
            "Run: pip install supabase"
        ) from exc

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not url or not key:
        raise EnvironmentError(
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
            "in the environment (or .env file) before uploading to Supabase."
        )

    return create_client(url, key)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upload_evidence(project_id: str, prospects_with_evidence: list[dict]) -> None:
    """Upload pipeline results (prospects + evidence) to Supabase.

    For each prospect that carries an ``evidence`` list the function:
      1. Looks up the prospect UUID in the ``prospects`` table by name + project_id.
      2. Uploads any local screenshot files to Supabase Storage under
         ``evidence/{project_id}/{prospect_id}/``.
      3. Inserts a row into the ``evidence`` table for every evidence item.

    Args:
        project_id:              UUID of the project row in Supabase.
        prospects_with_evidence: List of prospect dicts as returned by the pipeline
                                 (each may have an ``evidence`` key with a list of
                                 evidence item dicts).
    """
    try:
        client = _get_client()
    except (ImportError, EnvironmentError) as exc:
        print(f"[supabase_uploader] Cannot connect: {exc}")
        return

    total_uploaded = 0
    total_errors = 0

    for prospect in prospects_with_evidence:
        evidence_items: list[dict] = prospect.get("evidence") or []
        if not evidence_items:
            continue

        prospect_name: str = prospect.get("name") or prospect.get("company_name") or ""
        prospect_id: str | None = _lookup_prospect_id(client, project_id, prospect_name)

        if not prospect_id:
            print(
                f"[supabase_uploader] ⚠️  Prospect not found in DB: "
                f"'{prospect_name}' (project {project_id}) — skipping {len(evidence_items)} items"
            )
            total_errors += len(evidence_items)
            continue

        print(
            f"[supabase_uploader] Uploading {len(evidence_items)} evidence items "
            f"for '{prospect_name}' ({prospect_id[:8]}…)"
        )

        for item in evidence_items:
            try:
                _upload_single_evidence(client, project_id, prospect_id, item)
                total_uploaded += 1
            except Exception as exc:  # noqa: BLE001
                source = item.get("source_url", "(unknown)")
                print(f"[supabase_uploader] ❌ Error uploading evidence for {source}: {exc}")
                total_errors += 1

    print(
        f"[supabase_uploader] Done — {total_uploaded} uploaded, {total_errors} errors"
    )


def upload_pattern_analysis(project_id: str, patterns: dict) -> None:
    """Persist pattern-analysis output to the ``feedback`` table.

    The portal reads pattern data from the feedback table so that users can
    see which traits were preferred / avoided across the pipeline run.

    Args:
        project_id: UUID of the project row in Supabase.
        patterns:   Dict as returned by ``pattern_analyzer.analyze_feedback_patterns``.
    """
    try:
        client = _get_client()
    except (ImportError, EnvironmentError) as exc:
        print(f"[supabase_uploader] Cannot connect: {exc}")
        return

    try:
        client.table("feedback").insert(
            {
                "project_id": project_id,
                "type": "pattern_analysis",
                "text": json.dumps(patterns, ensure_ascii=False),
            }
        ).execute()
        print(f"[supabase_uploader] Pattern analysis saved for project {project_id[:8]}…")
    except Exception as exc:  # noqa: BLE001
        print(f"[supabase_uploader] ❌ Failed to save pattern analysis: {exc}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lookup_prospect_id(client, project_id: str, name: str) -> str | None:
    """Return the UUID of a prospect row matching *name* + *project_id*, or None."""
    if not name:
        return None
    try:
        response = (
            client.table("prospects")
            .select("id")
            .eq("project_id", project_id)
            .eq("company_name", name)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows[0]["id"]
    except Exception as exc:  # noqa: BLE001
        print(f"[supabase_uploader] Warning: prospect lookup failed for '{name}': {exc}")
    return None


def _upload_single_evidence(
    client,
    project_id: str,
    prospect_id: str,
    item: dict,
) -> None:
    """Upload one evidence item: screenshot (if present) + DB row."""
    local_path: str = item.get("screenshot_path") or ""
    storage_url: str = ""

    # -- Storage upload -------------------------------------------------------
    if local_path and Path(local_path).is_file():
        storage_url = _upload_screenshot(client, project_id, prospect_id, local_path)

    # -- DB insert ------------------------------------------------------------
    related_scores = item.get("related_scores") or []
    # Supabase expects jsonb; pass as Python list (the driver serialises it)
    row = {
        "prospect_id": prospect_id,
        "source_url": item.get("source_url") or "",
        "source_type": item.get("source_type") or "",
        "screenshot_path": storage_url or local_path,
        "text_excerpt": item.get("text_excerpt") or "",
        "text_translated": item.get("text_translated") or "",
        "related_scores": related_scores,
        "content_date": item.get("content_date"),  # None → NULL
    }
    client.table("evidence").insert(row).execute()


def _upload_screenshot(
    client,
    project_id: str,
    prospect_id: str,
    local_path: str,
) -> str:
    """Upload a screenshot file to Supabase Storage and return its public URL.

    Returns an empty string if the upload fails (error is printed, not raised).
    """
    filename = Path(local_path).name
    storage_path = f"{project_id}/{prospect_id}/{filename}"

    try:
        with open(local_path, "rb") as fh:
            file_bytes = fh.read()

        client.storage.from_("evidence").upload(
            storage_path,
            file_bytes,
            {"content-type": "image/png"},
        )

        # Build the public URL from the project URL
        base_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        public_url = f"{base_url}/storage/v1/object/public/evidence/{storage_path}"
        return public_url

    except Exception as exc:  # noqa: BLE001
        print(
            f"[supabase_uploader] Warning: screenshot upload failed for "
            f"'{local_path}': {exc}"
        )
        return ""
