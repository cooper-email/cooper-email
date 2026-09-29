# Publishing the Cooper Email SDKs

Do not publish from a pull request. Publish `cooper-email` on npm and on PyPI before any package that depends on it. Operator on every package: Avatar 8 LLC, `ops@avatar33.com`.

Names below returned HTTP 404 from `registry.npmjs.org` and `https://pypi.org/pypi/<name>/json` on 28 Sep 2026, so they were available. Re-check before the first publish. If a name is taken, stop and pick another; do not squat.

## npm

| Directory | Package |
| --- | --- |
| `packages/cooper-email` | `cooper-email` |
| `packages/langchain` | `cooper-email-langchain` |
| `packages/ai` | `cooper-email-ai` |
| `packages/mastra` | `cooper-email-mastra` |
| `packages/anthropic` | `cooper-email-anthropic` |
| `packages/openai-agents` | `cooper-email-openai-agents` |
| `packages/n8n-nodes-cooper-email` | `n8n-nodes-cooper-email` |
| `packages/openapi` | `cooper-email-openapi` |

```bash
export NPM_TOKEN=npm_...
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
npm ci
npm run build:sdks

cd packages/cooper-email && npm publish --access public
cd ../langchain && npm publish --access public
cd ../ai && npm publish --access public
cd ../mastra && npm publish --access public
cd ../anthropic && npm publish --access public
cd ../openai-agents && npm publish --access public
cd ../n8n-nodes-cooper-email && npm publish --access public
cd ../openapi && npm publish --access public
```

`npm run build:sdks` writes `dist/` for the TypeScript packages. The n8n node and the OpenAPI snapshot ship source files and do not use that build.

## PyPI

| Directory | Package |
| --- | --- |
| `packages/cooper-email-python` | `cooper-email` |
| `packages/langchain-py` | `cooper-email-langchain` |
| `packages/llamaindex` | `cooper-email-llamaindex` |
| `packages/crewai` | `cooper-email-crewai` |
| `packages/openai-agents-py` | `cooper-email-openai-agents` |
| `packages/anthropic-py` | `cooper-email-anthropic` |

```bash
python -m pip install build twine
export TWINE_USERNAME=__token__
export TWINE_PASSWORD="$PYPI_API_TOKEN"

cd packages/cooper-email-python && python -m build && twine upload dist/*
cd ../langchain-py && python -m build && twine upload dist/*
cd ../llamaindex && python -m build && twine upload dist/*
cd ../crewai && python -m build && twine upload dist/*
cd ../openai-agents-py && python -m build && twine upload dist/*
cd ../anthropic-py && python -m build && twine upload dist/*
```

`PYPI_API_TOKEN` is a PyPI API token (`pypi-...`) scoped to these projects.

## GitHub Actions

`.github/workflows/publish-sdks.yml` publishes on a published GitHub Release, or when someone runs the workflow by hand. It reads `NPM_TOKEN` and `PYPI_API_TOKEN` from repository secrets. It does not run on pull requests.
