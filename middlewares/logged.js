module.exports = function(req, res, next){
    if(!req.session.passport) return res.redirect('/login')
    
    next()
}