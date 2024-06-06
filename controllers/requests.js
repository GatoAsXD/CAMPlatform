const {Options, Class, Student, request, userExists, parseClassInstance, parseStudentInstance} = require("../util")
const model = require('../models/userData')

module.exports = {
    reqAll: async function(req, res){
        const user = req.session.passport.user
        var accessToken = user.accessToken
        
        if(!accessToken) return

        if(!(await userExists(user.profile.id))){
            const createUser = new model({
                userId: user.profile.id,
                name: user.profile.displayName
            })
            await createUser.save()

            const optionsAll = new Options(accessToken)

            request(optionsAll)
                .then(data => {

                    data.courses.forEach(element => {
                        var [grade, section] = element.name.split(" ")

                        userClass = new Class(element.id, grade, section)

                        request(new Options(accessToken, `${element.id}/students`)).then(async students => {
                            students.students.forEach(e => {
                                userClass.addStudent(new Student(e.userId, e.profile.name.fullName))
                            })
                            var dbUser = await model.findOne({userId: user.profile.id})
                            dbUser.classes.push(parseClassInstance(userClass))

                            await model.findOneAndUpdate({userId: user.profile.id},{classes: dbUser.classes})
                        })
                    });
                })
                .catch(err => {
                    console.error(`Error on Get Request --> ${err}`)
                })

        }

    }
}