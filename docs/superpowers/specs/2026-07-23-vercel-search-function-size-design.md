# Vercel Search Function Size Design

## Problem

The Vercel deployment rejects the `api/search` function because its uncompressed
size is 375.88 MB, above the standard 250 MB limit. The Next.js output trace
shows that externalizing `@huggingface/transformers` causes the complete
`onnxruntime-node` package to be copied into the function. That package includes
native binaries for several operating systems and architectures; its Linux x64
CUDA provider alone is about 302 MB.

The webpack aliases for `onnxruntime-node` and `sharp` do not reduce the trace
while Transformers.js is listed in `serverExternalPackages`, because external
packages bypass webpack processing.

## Design

Remove `@huggingface/transformers` from `serverExternalPackages`. Keep the
webpack aliases that disable `onnxruntime-node` and `sharp`, allowing
Transformers.js to use its WebAssembly inference backend in the server function.

The embedding contract remains unchanged:

- model: `Xenova/multilingual-e5-small`
- data type: `q8`
- query prefix: `query: `
- pooling: mean
- normalization: enabled
- output: `number[]`

No Vercel large-function beta flag is required by this design.

## Verification

Add a configuration regression test that rejects externalization of
Transformers.js and requires the aliases for `onnxruntime-node` and `sharp`.
Observe the test failing before changing the configuration and passing after the
change.

After a production build:

- the `api/search` Next.js output trace must not contain `onnxruntime-node` or
  its CUDA provider;
- the traced function files must total less than 250 MB uncompressed;
- embedding unit tests, the complete test suite, TypeScript checking, and the
  production build must pass;
- the critical-level dependency audit must pass.

## Risk

WebAssembly inference can have a slower cold start or lower throughput than the
native CPU backend. The application already loads the model lazily and reuses
the pipeline within a warm function instance. Preserving the model and
quantization settings keeps search semantics stable while avoiding native binary
packaging.
