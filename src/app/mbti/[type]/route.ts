interface RouteContext {
  params: Promise<{ type: string }> | { type: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const { type } = await context.params;
  return Response.json({ type });
}
