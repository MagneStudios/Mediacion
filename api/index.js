const { getServerlessApp } = require("../apps/api/dist/src/serverless");

module.exports = async function handler(request, response) {
  const app = await getServerlessApp();
  app(request, response);
};
