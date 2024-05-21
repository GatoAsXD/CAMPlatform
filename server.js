const bodyParser = require("body-parser")
const path = require("path")
const express = require("express")
const session = require("express-session")

const app = express()

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

app.get('/', (req, res) => {
    res.render('index.ejs')
})

app.listen(app.get('port'), () => {
    console.log("Online")
});
  
process.on("SIGINT", function(){
    console.log("Offline")
    process.exit()
})