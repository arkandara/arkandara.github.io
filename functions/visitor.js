// Visitor ID collection and management have been disabled.
// This endpoint no longer creates browser identifiers or stores visitor records.
export async function onRequest() {
    return new Response(JSON.stringify({ error: 'visitor_id_removed' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
