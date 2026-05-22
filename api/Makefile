# api/Makefile — convenience targets for the Go microservices workspace.
#
# Build / test / lint normally happen in GitHub Actions
# (.github/workflows/api-build.yml). These targets exist for fast local
# loops AND for the iogrid-proxy smoke probe operators run against a
# live cluster to validate the residential-proxy chain.

GO        ?= go
GOFLAGS   ?=
ENRICH_DIR = ./services/vcard-api/enrich
SMOKE_DIR  = ./services/vcard-api/cmd/smoke-proxy

.PHONY: help
help: ## Show this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_.-]+:.*## / {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: build
build: ## Build every service in the workspace.
	$(GO) build $(GOFLAGS) ./...

.PHONY: test
test: ## Run the full workspace test suite.
	$(GO) test $(GOFLAGS) ./...

.PHONY: test-enrich
test-enrich: ## Run only the enrich-package tests (offline / no proxy).
	$(GO) test $(GOFLAGS) -v $(ENRICH_DIR)/...

.PHONY: smoke-proxy
smoke-proxy: ## Probe iogrid SOCKS5+TLS proxy egress; fails if IP == local IP.
	@if [ -z "$$IOGRID_API_KEY" ] || [ -z "$$IOGRID_WORKSPACE" ]; then \
	  echo "smoke-proxy: set IOGRID_API_KEY + IOGRID_WORKSPACE (IOGRID_PROXY_URL defaults to proxy.iogrid.org:443)"; \
	  exit 2; \
	fi
	$(GO) run $(SMOKE_DIR)

.PHONY: vet
vet: ## go vet across the workspace.
	$(GO) vet $(GOFLAGS) ./...

.PHONY: tidy
tidy: ## go mod tidy across every module in go.work.
	@for d in shared services/linkedin-oauth services/pass-signer services/photo-cdn services/vcard-api services/web-profile; do \
	  if [ -f "$$d/go.mod" ]; then echo "tidy $$d"; (cd "$$d" && $(GO) mod tidy); fi; \
	done
