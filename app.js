require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const {
    Passport
} = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const nodemailer = require('nodemailer');
const {
    render,
    redirect
} = require('express/lib/response');


const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/public'));


app.use(session({
    secret: "adityaag29000000@gmail.com",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/mediaDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);

const postSchema = {
    postContent: String,
    postComments: [{
        commentUserName: String,
        commentContent: String
    }],
    postLikes: String,
    postUserName: String,
    postCatagory: String
};


const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    displayname: String,
    photo: String,
    googleId: String,
    data: String,
    verified: String,
    admin: Boolean
});

const contactSchema = {
    email: String,
    query: String,
};

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const Post = mongoose.model("Post", postSchema);

const Contact = mongoose.model("Contact", contactSchema);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});


app.get("/login", function (req, res) {
    res.render("login", {
        error: ""
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

app.get("/register", function (req, res) {
    res.render("register", {
        error: ""
    });
});


app.post("/register", function (req, res) {
    const displayName = req.body.displayname;
    if (req.body.password === req.body.confirmpassword) {
        User.register({
            username: req.body.username
        }, req.body.password, function (err, user) {
            if (err) {
                res.render("register", {
                    error: "Email already Registered"
                });
            } else {
                passport.authenticate("local")(req, res, function () {
                    // res.render('adddisplayname');
                    User.findById(req.user.id, (err, foundUser) => {
                        if (err) {
                            res.render("register", {
                                error: "Account Creation Failed"
                            });
                        } else {
                            if (foundUser) {
                                foundUser.displayname = displayName;

                                foundUser.save(function () {
                                    res.redirect('/emailverification');
                                })
                            }
                        }
                    })
                });
            };
        });
    } else {
        res.render("register", {
            error: "Password did not match"
        });
    }
});

app.get('/emailverification', function (req, res) {

    User.findById(req.user.id, (err, foundUser) => {
        if (err) {
            res.render("register", {
                error: "Email verification Failed"
            });
        } else {
            if (foundUser) {
                const val = Math.floor(1000 + Math.random() * 9000);

                app.set(foundUser.username, val);

                var transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'gcetmedia46@gmail.com',
                        pass: 'gcet@123'
                    }
                });

                var mailOptions = {
                    from: 'gcetmedia46@gmail.com',
                    to: foundUser.username,
                    subject: `Verification code for signup`,
                    html: `<p>Your verification code for signup in eccmedia.com is ${val}. For account safety do not share your code with others.</p><h1>Code: ${val}</h1>`
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        res.render("register", {
                            error: "Invalid Email"
                        });
                    } else {
                        res.render('emailverification');
                    }
                });
            } else {
                res.render("register", {
                    error: "Email verification Failed"
                });
            }
        }
    })
});

app.post("/emailverification", function (req, res) {
    var code = req.body.code;
        User.findById(req.user.id, (err, foundUser) => {
        if (err) {
            res.render("register", {
                error: "Email verification Failed"
            });
        } else {
            if (foundUser) {
                if (app.get(foundUser.username) == code) {
                    foundUser.verified = "Verified";
                    foundUser.save(function () {
                        res.redirect('/');
                    });
                } else {
                    res.render('emailverification')
                }
            }
        }
    })
});

app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            res.render("login", {
                error: "Wrong Email or Password"
            });
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect('/');
            });
        }
    });
});

app.get("/account", function (req, res) {
    Register.find({
        username: globalUser
    }, function (err, details) {
        res.render("compose", {
            page: "Compose",
            detail: details,
            userName: globalUser,
            page: "Admin"
        });
    });
});

app.get("/", function (req, res) {
    if (req.isAuthenticated()) {
        Post.find({}, function (err, post) {
            res.render("index", {
                posts: post,
                page: "ECC Media",
                userName: req.user.displayname,
                userAdmin: req.user.admin
            });
        });
    } else {
        res.redirect("login");
    }
});

app.post("/", function (req, res) {
    const post = new Post({
        postContent: req.body.postContent,
        postUserName: req.body.postUserName,
        postCatagory: req.body.catagory
    });

    post.save(function (err) {
        if (!err) {
            res.redirect("/");
        } else {
            res.redirect("/compose");
        }
    });
});

app.post("/delete", (req, res) => {
    const temp = req.body.postContent;
    Post.deleteOne({
        postContent: temp
    }, (err) => {
        if (req.isAuthenticated()) {
            Post.find({}, function (err, post) {
                res.render("index", {
                    posts: post,
                    page: "ECC Media",
                    userName: req.user.displayname,
                    userAdmin: req.user.admin
                });
            });
        } else {
            res.redirect("login");
        }
    })
});

app.get("/notifications", function (req, res) {
    if (req.isAuthenticated()) {
        Post.find({
            postCatagory: "notification"
        }, function (err, post) {
            res.render("index", {
                posts: post,
                page: "ECC Media",
                userName: req.user.displayname,
                userAdmin: req.user.admin
            });
        });
    } else {
        res.redirect("login");
    }
});

app.get("/whats-going-on", function (req, res) {
    if (req.isAuthenticated()) {
        Post.find({
            postCatagory: "goingon"
        }, function (err, post) {
            res.render("index", {
                posts: post,
                page: "ECC Media",
                userName: req.user.displayname,
                userAdmin: req.user.admin
            });
        });
    } else {
        res.redirect("login");
    }
});

app.get("/interships", function (req, res) {
    if (req.isAuthenticated()) {
        Post.find({
            postCatagory: "internship"
        }, function (err, post) {
            res.render("index", {
                posts: post,
                page: "ECC Media",
                userName: req.user.displayname,
                userAdmin: req.user.admin
            });
        });
    } else {
        res.redirect("login");
    }
});

app.post('/handlecomment', (req, res) => {
    const comment = req.body.comment;
    const postID = req.body.postid;
    const userName = req.body.username;
    Post.findById(postID, (err, foundPost) => {
        if (err) {
            throw err;
        } else {
            if (foundPost) {
                foundPost.postComments.push({
                    commentUserName: userName,
                    commentContent: comment
                })
                foundPost.save(function () {
                    Post.find({
                        _id: postID
                    }, function (err, post) {
                        res.render("comment", {
                            posts: post,
                            page: "Home",
                            userName: req.user.displayname
                        });
                    })
                })
            }
        }
    })
});



app.get("/admin", function (req, res) {
    res.redirect("login");
});

app.get("/allblogs", function (req, res) {
    res.render('blogs');
});

app.get("/thank-you", function (req, res) {
    res.render("thank-you", {
        page: "About"
    });
});

app.get("/404notfound", function (req, res) {
    res.render("404notfound", {
        page: "404 Not Found"
    });
});

app.get("/about", function (req, res) {
    if (req.isAuthenticated()) {
            res.render("about", {
                page: "About",
                userName: req.user.displayname,
            });
    } else {
        res.redirect("login");
    }
});

app.get("/report", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("contact", {
            page: "Report",
            userName: req.user.displayname,
        });
} else {
    res.redirect("login");
}
});

app.get("/help", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("contact", {
            page: "Help",
            userName: req.user.displayname,
        });
} else {
    res.redirect("login");
}
});

app.post("/contact", function (req, res) {
    const contact = new Contact({
        email: req.body.email,
        query: req.body.query
    });

    contact.save(function (err) {
        if (!err) {
            res.redirect("/");
        } else {
            res.redirect("/contact");
        }
    });
});

app.get("/privacy-policy", function (req, res) {
    res.render("privacy-policy", {
        page: "Privacy-Policy"
    });
});

app.get("/terms-conditions", function (req, res) {
    res.render("terms-conditions", {
        page: "Terms And Conditions"
    });
});

app.get("/like/:page", function (req, res) {
    const requestedPage = req.params.page;
    if (req.isAuthenticated()) {
        Post.find({
            _id: requestedPage
        }, function (err, post) {
            post.postLikes = post.postLikes + 1;
            res.redirect('/');
        });
    } else {
        res.redirect("login");
    }
});

app.get("/:page", function (req, res) {
    const requestedPage = req.params.page;
    if (req.isAuthenticated()) {
        Post.find({
            _id: requestedPage
        }, function (err, post) {
            res.render("comment", {
                posts: post,
                page: "Home",
                userName: req.user.displayname
            });
        });
    } else {
        res.redirect("login");
    }
});

app.listen(3000, function () {
    console.log("Server is running on port 3000");
})