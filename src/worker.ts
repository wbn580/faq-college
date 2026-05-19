export default {
  async fetch(request, env) {
    // Workers Static Assets handles all static files via ASSETS binding
    // This worker only runs for routes that don't match a static file
    return env.ASSETS?.fetch(request) || new Response('Not Found', { status: 404 });
  },
};
