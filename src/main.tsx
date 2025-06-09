/**
 * Entry point for the React application. It mounts the App component
 * into the DOM element with id="root".
 */
import { createRoot } from 'react-dom/client'

import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
