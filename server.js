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

const requests = require("./controllers/requests")

app.use(express.static(path.join(__dirname, 'public/css')))
app.use(express.static(path.join(__dirname, 'public/js')))
app.use(express.static(path.join(__dirname, 'public/assets')))

app.use(passport.initialize())
app.use(passport.session())

//Routes
app.get('/', (req, res) => {
    res.render('index.ejs')
})

app.get('/success', (req, res) => {
    res.render('success.ejs')
    requests.reqAll(req, res)
})

app.get('error', (req, res) => res.send("error logging in"))


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

app.listen(app.get('port'), () => {
    console.log("Online")
});
  
process.on("SIGINT", function(){
    console.log("Offline")
    process.exit()
})