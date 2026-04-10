import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

// Importing from workspace packages
import type { User } from '@voicelane/api-interfaces'
import { isValidEmail, API_VERSION, DEFAULT_PAGE_SIZE } from '@voicelane/core'

function App() {
  const [count, setCount] = useState(0)
  const [email, setEmail] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)

  // Example of using the User type from api-interfaces
  const exampleUser: User = {
    id: '1',
    email: 'demo@voicelane.com',
    name: 'Demo User',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const handleEmailValidation = () => {
    setIsValid(isValidEmail(email))
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Voicelane - Vite + React</h1>
      
      <div className="card">
        <p>API Version: <code>{API_VERSION}</code></p>
        <p>Default Page Size: <code>{DEFAULT_PAGE_SIZE}</code></p>
        <p>Example User: <code>{exampleUser.name}</code></p>
      </div>

      <div className="card">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email to validate"
          style={{ padding: '8px', marginRight: '8px' }}
        />
        <button onClick={handleEmailValidation}>
          Validate Email
        </button>
        {isValid !== null && (
          <p style={{ color: isValid ? 'green' : 'red' }}>
            {isValid ? 'Valid email!' : 'Invalid email!'}
          </p>
        )}
      </div>

      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
