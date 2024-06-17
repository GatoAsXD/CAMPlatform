const bodyParser = require("body-parser");
const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const mongoStore = require("connect-mongo");

const CLIENT_ID = process.env["CLIENT_ID"];
const CLIENT_SECRET = process.env["CLIENT_SECRET"];
const REDIRECT_URL = "https://cbffed7c-fd84-4089-bd21-f516df58a17d-00-35z9wsb97p02n.riker.replit.dev:3000/auth/google/callback";
const uri = process.env["uri"];

const model = require("./models/userData");
const requests = require("./controllers/requests");
const logged_middleware = require("./middlewares/logged");
const loadData_middleware = require("./middlewares/loadData");

const app = express();
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
mongoose.connect(uri, {}).catch((err) => console.log(err));

const db = mongoose.connection;
db.once("open", (_) => {
    console.log("Database connected");
});

app.set("port", process.env.PORT);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
    session({
        secret: [process.env["SECRET"]],
        resave: false,
        saveUninitialized: false,
        store: mongoStore.create({
            client: db.getClient(),
            touchAfter: 2 * 3600,
        }),
    }),
);

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

            res.locals.studentList = studentList;
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
        if (studentParam != "compliance")
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
        if (studentData[index].role.toLowerCase() == "tutor")
            studentRole = "tutor";
        if (studentData[index].role.toLowerCase() == "tutoreado")
            studentRole = "tutoreado";

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
