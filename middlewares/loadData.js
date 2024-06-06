const model = require('../models/userData')

module.exports = async function(req, res, next){
    
    const findUser = await model.findOne({userId: req.session.passport.user.profile.id})

    res.locals.userClasses = findUser.classes
    res.locals.userName = findUser.name
    
    next()
}