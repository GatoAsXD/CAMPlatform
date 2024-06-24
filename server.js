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
    store: mongoStore.create({ client: db.getClient(), touchAfter: 3600 })
}))

app.use(express.static(path.join(__dirname, "public/css")));
app.use(express.static(path.join(__dirname, "public/js")));
app.use(express.static(path.join(__dirname, "public/assets")));

app.use(passport.initialize());
app.use(passport.session());

//Routes
app.get(
    "/login",
    (req, res, next) => {
        if (req.session.passport) return res.redirect("/classes");

        next();
    },
    (req, res) => {
        res.render("login.ejs");
    },
);

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: [
            "profile",
            "https://www.googleapis.com/auth/classroom.courses.readonly",
            "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
            "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
            "https://www.googleapis.com/auth/classroom.rosters.readonly",
            "https://www.googleapis.com/auth/classroom.topics.readonly",
        ],
    }),
);

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/error" }),
    function (req, res) {
        res.redirect("/success");
    },
);

app.use(logged_middleware);

app.get("/success", (req, res) => {
    requests.reqAll(req, res).then(async () => {
        const findUser = await model.findOne({
            userId: req.session.passport.user.profile.id,
        });

        res.locals.userClasses = findUser.classes;
        res.locals.userName = findUser.name;

        res.redirect("/classes");
    });
});
app.get("error", (req, res) => res.send("error logging in"));

app.use(loadData_middleware);

app.get("/", (req, res) => {
    res.redirect("/classes");
});
app.get("/clases", (req, res) => {
    res.redirect("/classes");
});

app.get("/classes", (req, res) => {
    let userGrades = [];
    let userClasses = {};
    let userClassesId = {};

    for (let i = 0; i < res.locals.userClasses.length; i++) {
        const e = res.locals.userClasses[i];
        if (!userGrades.includes(e.grade)) {
            userGrades.push(e.grade);
            userClasses[e.grade] = [];
            userClassesId[e.grade] = [];
        }

        userClasses[e.grade].push(e.grade + " " + e.section);
        userClassesId[e.grade].push(e.classID);
    }
    res.locals.userGrades = userGrades;
    res.locals.userClassList = userClasses;
    res.locals.userClassId = userClassesId;
    res.render("classes.ejs");
});

app.get("/classes/:id", async (req, res) => {
    res.locals.route = `/classes/${req.params.id}/edit`;
    for (let i = 0; i < res.locals.userClasses.length; i++) {
        const e = res.locals.userClasses[i];

        if (e.classID == req.params.id) {
            res.locals.userClassName = e.grade + " " + e.section;
            let userGrades = [];
            let userOldGrades = [];

            requests.reqHomework(req, e).then(async () => {
                let userData = JSON.parse(
                    JSON.stringify(
                        await model.findOne({
                            userId: req.session.passport.user.profile.id,
                        }),
                    ),
                ).classes;
                for (let index = 0; index < e.students.length; index++) {
                    const element = e.students[index];
                    userData[i].students[index].homeworkCompliance = e.grades[
                        element.id
                    ].every((val) => val === true);
                }
                await model.findOneAndUpdate(
                    { userId: req.session.passport.user.profile.id },
                    { classes: userData },
                );
            });

            const findUser = await model.findOne({
                userId: req.session.passport.user.profile.id,
            });

            res.locals.userClass = findUser.classes[i];

            let studentList = {
                student: findUser.classes[i].students.filter((el) => {
                    return el.role == "student";
                }),
                tutor: findUser.classes[i].students.filter((el) => {
                    return el.role == "tutor";
                }),
                tutoreado: findUser.classes[i].students.filter((el) => {
                    return el.role == "tutoreado";
                }),
            };
            let studentListG = findUser.classes[i].students;
            let studentCount = findUser.classes[i].students.length;
            let revisadosCount = 0;

            for (let index = 0; index < studentCount; index++) {
                const element = studentListG[index];
                userGrades.push(element.grades["c1"]);
                userOldGrades.push(element.oldGrades["c1"]);
                userGrades.push(element.grades["c2"]);
                userOldGrades.push(element.oldGrades["c2"]);
                userGrades.push(element.grades["c3"]);
                userOldGrades.push(element.oldGrades["c3"]);
                userGrades.push(element.grades["c4"]);
                userOldGrades.push(element.oldGrades["c4"]);

                revisadosCount += parseInt(element.revisados);
            }
            let userGradesCount = [];
            let userOldGradesCount = [];
            let revisadosAverage = Math.round(revisadosCount/studentCount);

            userGradesCount.push(userGrades.filter((v) => v === "AD").length);
            userGradesCount.push(userGrades.filter((v) => v === "A").length);
            userGradesCount.push(userGrades.filter((v) => v === "B").length);
            userGradesCount.push(userGrades.filter((v) => v === "C").length);
            userOldGradesCount.push(userOldGrades.filter((v) => v === "AD").length);
            userOldGradesCount.push(userOldGrades.filter((v) => v === "A").length);
            userOldGradesCount.push(userOldGrades.filter((v) => v === "B").length);
            userOldGradesCount.push(userOldGrades.filter((v) => v === "C").length);

            let userGradesTotalValue = [0, 0, 0, 0]
            let userOldGradesTotalValue = [0, 0, 0, 0]
            let userGradesAverageValue = [0, 0, 0, 0]
            let userOldGradesAverageValue = [0, 0, 0, 0]

            function gradeValue (grade){
                if(grade === "AD") return 19
                if(grade === "A") return 16
                if(grade === "B") return 12
                if(grade=== "C") return 8
            }

            let userStudentCount = userGrades.length / 4
            
            for(let index = 0; index < userGrades.length; index+=4){
                const el1 = [userGrades[index], userGrades[index+1], userGrades[index+2], userGrades[index+3]]
                const el2 = [userOldGrades[index], userOldGrades[index+1], userOldGrades[index+2], userOldGrades[index+3]]
                for(let ind = 0; ind < el1.length; ind++){
                    userGradesTotalValue[ind] += gradeValue(el1[ind])
                    userOldGradesTotalValue[ind] += gradeValue(el2[ind])
                }
            }
            for(let index = 0; index < 4; index++){
                userGradesAverageValue[index] = userGradesTotalValue[index] / userStudentCount
                userOldGradesAverageValue[index] = userOldGradesTotalValue[index] / userStudentCount
            }


            res.locals.studentList = studentList;
            res.locals.userGrades = userGradesCount;
            res.locals.userOldGrades = userOldGradesCount;
            res.locals.averageGrades = userGradesAverageValue;
            res.locals.averageOldGrades = userOldGradesAverageValue;
            res.locals.revisadosAverage = revisadosAverage;
            res.locals.revisadosCount = revisadosCount;

            res.render("class.ejs");
        }
    }
});
app.get("/classes/:id/edit", (req, res) => {
    res.locals.userClasses.forEach((e) => {
        if (e.classID == req.params.id) {
            res.locals.userClass = e;
            res.locals.userClassName =
                e.grade + " " + e.section + " - Editar datos";

            let studentList = {
                student: e.students.filter((el) => {
                    return el.role == "student";
                }),
                tutor: e.students.filter((el) => {
                    return el.role == "tutor";
                }),
                tutoreado: e.students.filter((el) => {
                    return el.role == "tutoreado";
                }),
            };

            res.locals.studentList = studentList;
            res.locals.route = `/classes/${req.params.id}/save`;

            res.render("edit.ejs");
        }
    });
});
app.post("/classes/:id/save", async (req, res) => {
    let students = [];
    let studentOrder = [];
    let studentData = {};

    for (const [key, value] of Object.entries(req.body)) {
        const studentId = key.split("-")[0];
        const studentParam = key.split("-")[1];
        if (!students.includes(studentId)) {
            students.push(studentId);
            studentData[studentId] = {
                c1: "",
                c2: "",
                c3: "",
                c4: "",
                role: "",
                revisados: "",
                compliance: false,
            };
        }
        if (studentParam == "revisados")
            isNaN(value) ? studentData[studentId][studentParam] = 0 : studentData[studentId][studentParam] = value;
        else if (studentParam != "compliance")
            studentData[studentId][studentParam] = value;
        else studentData[studentId][studentParam] = true;
    }
    let userData = JSON.parse(
        JSON.stringify(
            await model.findOne({
                userId: req.session.passport.user.profile.id,
            }),
        ),
    ).classes;
    let classIndex;

    for (let index = 0; index < userData.length; index++) {
        const element = userData[index];
        if (element.classID == req.params.id) classIndex = index;
    }

    for (let index = 0; index < students.length; index++) {
        studentOrder.push(userData[classIndex].students[index].id);
    }

    for (let inde = 0; inde < students.length; inde++) {
        //const element = students[index];
        const index = students[inde];
        const ind = studentOrder.indexOf(index);

        let studentRole;
        
        if (studentData[index].role.toLowerCase() == "alumno")
            studentRole = "student";
        else if (studentData[index].role.toLowerCase() == "tutor")
            studentRole = "tutor";
        else if (studentData[index].role.toLowerCase() == "tutoreado")
            studentRole = "tutoreado";
        else studentRole = "student"

        userData[classIndex].students[ind].aleksCompliance =
            studentData[index].compliance;
        userData[classIndex].students[ind].revisados =
            studentData[index].revisados;
        userData[classIndex].students[ind].role = studentRole;
        userData[classIndex].students[ind].oldGrades.c1 =
            userData[classIndex].students[ind].grades.c1;
        userData[classIndex].students[ind].oldGrades.c2 =
            userData[classIndex].students[ind].grades.c2;
        userData[classIndex].students[ind].oldGrades.c3 =
            userData[classIndex].students[ind].grades.c3;
        userData[classIndex].students[ind].oldGrades.c4 =
            userData[classIndex].students[ind].grades.c4;
        userData[classIndex].students[ind].grades.c1 = studentData[index].c1;
        userData[classIndex].students[ind].grades.c2 = studentData[index].c2;
        userData[classIndex].students[ind].grades.c3 = studentData[index].c3;
        userData[classIndex].students[ind].grades.c4 = studentData[index].c4;
    }
    await model.findOneAndUpdate(
        { userId: req.session.passport.user.profile.id },
        { classes: userData },
    );

    res.redirect(`/classes/${req.params.id}`);
});

passport.serializeUser(function (user, cb) {
    cb(null, user);
});
passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});

// Google OAUTH

passport.use(
    new GoogleStrategy(
        {
            clientID: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            callbackURL: REDIRECT_URL,
        },
        function (accessToken, refreshToken, profile, done) {
            user = {
                profile,
                accessToken,
            };
            return done(null, user);
        },
    ),
);

app.listen(app.get("port"), () => {
    console.log("Online");
});

process.on("SIGINT", function () {
    console.log("Offline");
    process.exit();
});
