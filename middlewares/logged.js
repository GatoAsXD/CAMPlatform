module.exports = async function(req, res, next){
    if(!req.session.userProfile) {
      app.locals.userProfile = null
      return next()
    }
    
    next()
  }