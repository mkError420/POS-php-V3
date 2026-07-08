# Assets Directory

Put your frontend assets (images, logos, icons, fonts, etc.) in this folder. You can import them directly into your React/JSX components using ES imports.

## Example Usage

In your JSX components (e.g., `Login.jsx` or `App.jsx`), you can import and reference images like this:

```javascript
import logo from './assets/logo.png';

function MyComponent() {
  return <img src={logo} alt="Logo" />;
}
```
