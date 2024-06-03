const https = require('https')

module.exports = {
    reqAll: async function(req, res){
        var accessToken = req.session.passport.user.accessToken
        if(!accessToken) return

        class Options {
            hostname = 'classroom.googleapis.com'
            method = 'GET'

            constructor(path = '', port = 443) {
                this.path = `/v1/courses/${path}`
                this.port = port
                this.headers = {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        }

        class Student {
            #oldGrades = {}
            #grades = {}
            aleksCompliance = false
            homeworkCompliance = false
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

        }

        class Class {
            #students = {}

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
        
        const optionsAll = new Options()

        request(optionsAll)
            .then(data => {

                data.courses.forEach(element => {
                    var [grade, section] = element.name.split(" ")

                    var classe = new Class(element.id, grade, section)

                    request(new Options(`${element.id}/students`)).then(students => {
                        students.students.forEach(e => {
                            classe.addStudent(new Student(e.userId, e.profile.name.fullName))
                        })
                    })
                });
            })
            .catch(err => {
                console.error(`Error on Get Request --> ${err}`)
            })
        

    }
}