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
                                userClass.grades[e.userId] = []
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

    },
    reqHomework: async function(req, userClass) {
        const user = req.session.passport.user
        var accessToken = user.accessToken
        
        if(!accessToken) return


        const options = new Options(accessToken, `${userClass.classID}/courseWork`)
        const optionsTopics = new Options(accessToken, `${userClass.classID}/topics`)

        request(optionsTopics).then(topics => {
            let dates = []

            topics.topic.forEach(e => {
                dates.push(new Date(e.updateTime).valueOf())
            })

            const lastDate = Math.max(...dates)

            let lastTopic = topics.topic[dates.indexOf(lastDate)].topicId;

            request(options).then(hwsList => {
                let hws = []

                hwsList.courseWork.forEach(e => {
                    if(e.topicId == lastTopic){
                        hws.push(e.id)
                    }
                })
                for (let i = 0; i < hws.length; i++) {
                    const e = hws[i]
                    var hwOptions = new Options(accessToken, `${userClass.classID}/courseWork/${e}/studentSubmissions`)
                    request(hwOptions).then(async submissions => {
                        var findUser = await model.findOne({userId: req.session.passport.user.profile.id})
                        var userData = JSON.parse(JSON.stringify(findUser)).classes
                        let classIndex = 0

                        for (let ind = 0; ind < userData.length; ind++) {
                            const element = userData[ind];

                            if(element.classID == userClass.classID){
                                classIndex = ind
                            }
                        }

                        submissions.studentSubmissions.forEach(element => {
                            if(i==0){
                                userData[classIndex].grades[element.userId] = [((element.state == "TURNED_IN") && (element.assignmentSubmission.attachments != null))]
                            } else{
                                userData[classIndex].grades[element.userId].push(element.state)
                            }
                        });

                        await model.findOneAndUpdate({userId: req.session.passport.user.profile.id},{classes: userData})
                    })
                }
            })
        })
    }
}