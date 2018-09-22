const pathToRegexp = require('path-to-regexp')
const compose = require('koa-compose')

const debug = require('debug')('realtime:router')

function run(cb) {
  return new Promise((resolve, reject) => {
    Promise.resolve(cb(resolve, reject)).then(resolve).catch(reject)
  })
}

function createMiddleware(fn, re, end, keys, toPath) {
  if (re) {
    return function(ctx, next) {
      let {
        scope,
        params
      } = ctx

      if (typeof scope === 'string') {
        if (!('originalScope' in ctx)) {
          ctx.originalScope = scope
        }

        let match = re.exec(scope)

        if (match) {
          const nextParams = {}
          if (keys.length) {
            for (const index in keys) {
              const {
                name
              } = keys[index]

              nextParams[name] = match[+index + 1]
            }
          }

          if (!end) {
            let nextScope = scope.slice(toPath(nextParams).length)
            if (nextScope[0] !== '/') {
              nextScope = '/' + nextScope
            }

            ctx.scope = nextScope
          }

          return run((resolve, reject) => {
            ctx.params = nextParams

            try {
              return fn(ctx, () => {
                ctx.params = params
                ctx.scope = scope

                resolve(next())
              })
            } catch(error) {
              reject(error)
            }
          })
        }
      }

      return next()
    }
  }

  return function(ctx, next) {
    return run((resolve, reject) => {
      ctx.params = {}
      try {
        return fn(ctx, () => resolve(next()))
      } catch(error) {
        reject(error)
      }
    })
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

    debug('created')
  }

  message(...args) {
    return _attachMiddleware.call(this, ...args.slice(0, 2), true)
  }

  use(...args) {
    return _attachMiddleware.call(this, ...args.slice(0, 2), false)
  }

  scope(path) {
    const typeOfPath = typeof path
    if (typeOfPath !== 'string') {
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
