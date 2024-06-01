const bodyParser = require("body-parser")
const path = require("path")
const express = require("express")
const session = require("express-session")
const passport = require("passport")
const dotenv = require("dotenv")

const {google} = require('googleapis');
const classroom = google.classroom('v1');

const app = express()
dotenv.config()

const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
var userProfile;

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URL = process.env.REDIRECT_URL

app.set('port', process.env.PORT);
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(bodyParser.urlencoded({extended: false}))
app.use(session({
    secret: [process.env.SECRET],
    resave: false,
    saveUninitialized: false
}))


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
    console.log(userProfile)
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
        callbackURL: REDIRECT_URL
    },
    function(accessToken, refreshToken, profile, done) {
        userProfile=profile
        return done(null, userProfile)
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