const https = require('https')
const model = require('./models/userData')

class Options {
    hostname = 'classroom.googleapis.com'
    method = 'GET'

    constructor(accessToken, path = '', port = 443) {
        this.path = `/v1/courses/${path}`
        this.port = port
        this.headers = {
            'Authorization': `Bearer ${accessToken}`
        }
    }
}

class Student {
    #oldGrades = {
        c1: "",
        c2: "",
        c3: "",
        c4: ""
    }
    #grades = {
        c1: "",
        c2: "",
        c3: "",
        c4: ""
    }
    aleksCompliance = false
    homeworkCompliance = false
    role = "student"
    revisados = 0

    constructor(id, name) {
        this.id = id
        this.name = name
    }

    getGrades() {
        return this.#grades
    }

    getOldGrades() {
        return this.#oldGrades
    }

    getGrade(standard) {
        return this.#grades[standard]
    }

    setGrade(standard, value) {
        if(this.#grades[standard]) this.#oldGrades[standard] = this.#grades[standard]
        this.#grades[standard] = value
    }

    setRole(role) {
        this.role = role
    }

    loadGrades(grades) {
        this.#grades = grades
    }

    loadOldGrades(grades) {
        this.#oldGrades = grades
    }
}

class Class {
    #students = {}
    grades = {}

    constructor(id, grade, section) {
        this.classID = id
        this.grade = grade
        this.section = section
    }

    getStudents() {
        var students = []
        for (const [key, value] of Object.entries(this.#students)) {
            students.push(value)
        }
        return students
    }

    getStudent(studentName) {
        return this.#students[studentName]
    }

    addStudent(student) {
        this.#students[student.name] = student
    }
    
    addStudents(students) {
        students.forEach(e => {
            this.#students[e.name] = e
        });
    }
}

const request = (options) => new Promise ((resolve, reject) => {
    https.request(options, resp => {
        let data = '';

        resp.on('data', (chunk) => {
            data += chunk;
        });

        resp.on('end', async () => {
            parsedData = JSON.parse(data)
            resolve(parsedData)
        });

        resp.on('error', error => {
            reject(error)
        })
    }).end()
    
})

async function userExists (userId) {
    const findUser = await model.findOne({userId: userId})

    return findUser ? true : false
}

function parseStudentInstance (studentInstance) {
    let studentObject = Object.fromEntries(Object.entries(studentInstance))
    studentObject.grades = studentInstance.getGrades()
    studentObject.oldGrades = studentInstance.getOldGrades()

    return studentObject
}

function parseStudentObject (studentObject) {
    let studentInstance = new Student(studentObject.id, studentObject.name)
    studentInstance.loadGrades(studentObject.grades)
    studentInstance.loadOldGrades(studentObject.oldGrades)

    return studentInstance
}

function parseClassInstance (classInstance) {
    let classObject = classInstance
    classObject.students = classInstance.getStudents()

    for (let i = 0; i < classObject.students.length; i++) {
        const element = classObject.students[i];
        classObject.students[i] = parseStudentInstance(element)
    }

    return classObject
}

function parseClassObject (classObject) {
    let classInstance = new this.Class(classObject.classID, classObject.grade, classObject.section)
    let students = []

    classObject.students.forEach(e => {
        students.push(parseStudentObject(e))
    });

    classInstance.addStudents(students)

    return classInstance
}

module.exports = { Options, Student, Class,  request, userExists, parseClassInstance, parseClassObject, parseStudentInstance, parseStudentObject}