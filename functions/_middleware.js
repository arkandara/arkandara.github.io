// Visitor ID middleware removed. Pass all requests to the existing site handlers.
export async function onRequest(context) {
    return context.next();
}
