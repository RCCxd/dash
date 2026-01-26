import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { TasksProvider } from './state/tasks/TasksProvider.jsx'
import { GlobalDataProvider } from './state/global/GlobalDataProvider.jsx'
import { UserDataProvider } from './state/user/UserDataProvider.jsx'
import { SettingsProvider } from './state/settings/SettingsProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <GlobalDataProvider>
          <UserDataProvider>
            <TasksProvider>
              <App />
            </TasksProvider>
          </UserDataProvider>
        </GlobalDataProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
