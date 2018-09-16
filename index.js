const pathToRegexp = require('path-to-regexp')
const compose = require('koa-compose')
const debug = require('debug')('ws-router')

function createMiddleware(fn, re, end, keys, toPath) {
  return function (ctx, next) {
    let shouldHandle = true

    let {
      scope
    } = ctx

    if (scope) {
      if (!('originalScope' in ctx)) {
        ctx.originalScope = scope
      }

      if (re) {
        let match = re.exec(scope)

        if (!match) {
          shouldHandle = false
        } else {
          ctx = Object.assign({}, ctx)

          const params = {}

          if (keys && keys.length) {
            for (const index in keys) {
              const {
                name
              } = keys[index]

              params[name] = match[+index + 1]
            }

            ctx.params = Object.assign(ctx.params || {}, params)
          }

          if (!end) {
            scope = scope.slice(toPath(params).length)
            if (scope[0] !== '/') {
              scope = '/' + scope
            }

            ctx.scope = scope
          }
        }
      }
    }

    if (shouldHandle) {
      return fn(ctx, next)
    }

    return next()
  }
}

function _attachMiddleware(fn, end) {
  let path, re, keys, toPath

  if (2 in arguments) {
    path = fn
    fn = end
    end = arguments[2]
  }

  if (path) {
    toPath = pathToRegexp.compile(path)
    keys = []
    re = pathToRegexp(path, keys, {
      end
    })
  }

  this._middleware.push(createMiddleware(fn, re, end, keys, toPath))

  this._composedMiddleware = compose(this._middleware)

  debug('defined scope', path || '(.*)')

  return this
}

class WebsocketRouter {
  constructor() {
    const middleware = []
    this._middleware = middleware
    this._composedMiddleware = compose(middleware)
  }

  message(...args) {
    return _attachMiddleware.call(this, ...args.slice(0, 2), true)
  }

  use(...args) {
    return _attachMiddleware.call(this, ...args.slice(0, 2), false)
  }

  scope(path) {
    const typeOfPath = typeof path
    if(typeOfPath !== 'string') {
      throw new TypeError('First arguments should be a string, passed "' + typeOfPath + '"')
    }

    const router = new this.constructor()
    this.use(path, router.middleware())
    return router
  }

  middleware() {
    return (ctx, next) => this._composedMiddleware(ctx, next)
  }
}

module.exports = WebsocketRouter
