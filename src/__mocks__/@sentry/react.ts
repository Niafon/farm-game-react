// Mock Sentry for Jest tests
export const init = jest.fn()
export const captureException = jest.fn()
export const captureMessage = jest.fn()
export const withScope = jest.fn((callback) => {
  const mockScope = {
    setTag: jest.fn(),
    setLevel: jest.fn(),
    setContext: jest.fn(),
    setUser: jest.fn(),
  }
  return callback(mockScope)
})
export const addBreadcrumb = jest.fn()
export const showReportDialog = jest.fn()

export default {
  init,
  captureException,
  captureMessage,
  withScope,
  addBreadcrumb,
  showReportDialog,
}
