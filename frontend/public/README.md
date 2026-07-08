# Public Directory

Any assets placed in this folder will be served at the root path `/` and will not be processed by Vite/Rollup. Use this for files like `favicon.ico`, `robots.txt`, or static images that you want to reference by absolute URL.

## Example Usage

If you place a file named `logo.png` in this directory, you can reference it directly anywhere in your HTML or JSX without importing it:

```html
<!-- In index.html -->
<link rel="icon" href="/logo.png" />

<!-- In a React Component -->
<img src="/logo.png" alt="Logo" />
```
