// utils/asyncHandler.js

/**
 * Wrap an async Express handler and forward errors to next()
 * @param {Function} fn - async function(req, res, next)
 * @returns Express middleware
 */
module.exports = fn => {
  return (req, res, next) => {
    Promise
      .resolve(fn(req, res, next))
      .catch(next)
  }
}
