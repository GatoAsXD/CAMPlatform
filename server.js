require("dotenv").config()

const bodyParser = require("body-parser")
const path = require("path")
const express = require("express")
const session = require("express-session")
const passport = require("passport")
const mongoose = require("mongoose")
const mongoStore = require("connect-mongo")


const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URL = process.env.REDIRECT_URL
const uri = process.env.URI

const model = require('./models/userData')
const requests = require("./controllers/requests")
const logged_middleware = require('./middlewares/logged')
const loadData_middleware = require('./middlewares/loadData')

const app = express()
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
mongoose.connect(uri, {}).catch(err => console.log(err))


const db = mongoose.connection
db.once("open", _ => {
    console.log("Database connected")
})

app.set('port', process.env.PORT);
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(bodyParser.urlencoded({extended: false}))
app.use(session({
    secret: [process.env.SECRET],
    resave: false,
    saveUninitialized: false,
    store: mongoStore.create({ client: db.getClient(), touchAfter: 24*3600 })
}))


app.use(express.static(path.join(__dirname, 'public/css')))
app.use(express.static(path.join(__dirname, 'public/js')))
app.use(express.static(path.join(__dirname, 'public/assets')))

app.use(passport.initialize())
app.use(passport.session())

//Routes
app.get('/login', (req, res, next) => {
    if(req.session.passport) return res.redirect('/classes')
    
    next()
}, (req, res) =>{
    res.render('login.ejs')
})

app.get('/auth/google', passport.authenticate('google', {scope:[
    'profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.topics.readonly'
]}))

app.get('/auth/google/callback',
    passport.authenticate('google', {failureRedirect:'/error'}),
    function(req, res) {
        res.redirect('/success')
    }
)

app.use(logged_middleware)

app.get('/success', (req, res) => {
    requests.reqAll(req, res).then(async ()=>{
        const findUser = await model.findOne({userId: req.session.passport.user.profile.id})

        res.locals.userClasses = findUser.classes
        res.locals.userName = findUser.name

        res.redirect("/classes")
    })
})
app.get('error', (req, res) => res.send("error logging in"))

app.use(loadData_middleware)

app.get('/', (req, res) => {
    res.redirect('/classes')
})
app.get('/clases', (req, res) => {
    res.redirect('/classes')
})

app.get('/classes', (req, res) => {
    res.render('classes.ejs')
})

app.get('/classes/:id', async (req, res) => {
    
    res.locals.route = `/classes/${req.params.id}/edit`
    for (let i = 0; i < res.locals.userClasses.length; i++) {
        const e = res.locals.userClasses[i];

        if(e.classID == req.params.id){
            res.locals.userClassName = e.grade+" "+e.section
            
            requests.reqHomework(req, e).then(async ()=>{
                let userData = JSON.parse(JSON.stringify(await model.findOne({userId: req.session.passport.user.profile.id}))).classes
                for (let index = 0; index < e.students.length; index++) {
                    const element = e.students[index];
                    userData[i].students[index].homeworkCompliance = e.grades[element.id].every(val => val === true)
                }
                await model.findOneAndUpdate({userId: req.session.passport.user.profile.id},{classes: userData})
            })
            
            const findUser = await model.findOne({userId: req.session.passport.user.profile.id})

            res.locals.userClass = findUser.classes[i]

            res.render("class.ejs")
        }
        
    }

    //console.log(res.locals.userClass.getStudents())
})
app.get('/classes/:id/edit', (req, res) => {
    
    res.locals.userClasses.forEach(e => {
         if(e.classID == req.params.id){
            res.locals.userClass = e
            requests.reqHomework(req, e)
         }
    });

    //console.log(res.locals.userClass.getStudents())
    res.render("edit.ejs")
})


passport.serializeUser(function(user, cb) {
    cb(null, user)
})
passport.deserializeUser(function(obj, cb) {
    cb(null, obj)
})

// Google OAUTH

passport.use(new GoogleStrategy(
    {
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: REDIRECT_URL,
    },
    function(accessToken, refreshToken, profile, done) {
        user = {
            profile,
            accessToken
        }
        return done(null, user)
    }
))



app.listen(app.get('port'), () => {
    console.log("Online")
});
  
process.on("SIGINT", function(){
    console.log("Offline")
    process.exit()
})