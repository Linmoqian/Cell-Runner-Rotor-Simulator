import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'

const ObservationRoute = lazy(async () => {
  const routeModule = await import('./routes/ObservationRoute')
  return { default: routeModule.ObservationRoute }
})

function App() {
  return (
    <Suspense fallback={<div role="status" aria-label="正在加载观察台" />}>
      <Routes>
        <Route index element={<ObservationRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
