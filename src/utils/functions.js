const Transport = require("../verification/nodemailer");
const Flutterwave = require("flutterwave-node-v3");
const { Income } = require("../models/income.model");
const axios = require("axios");
const {Userverification} = require ('../models/userverification.model')
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const salt = parseInt(process.env.SALT);
require("dotenv").config();
const flw = new Flutterwave(process.env.FLUTTER_PUB, process.env.FLUTTER_SEC);

const api = axios.create({
  baseURL: "https://api.flutterwave.com/v3",
  headers: { Authorization: `Bearer ${process.env.FLUTTER_SEC}` },
});

exports.sendCode = function (email, code) {
  mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Forgot Password",
    html: `<h4>Kindly Enter the following Code:</h4>
        <h1 style="background:blue; color:white; text-align:center;">${code}</h1>`,
  };
  Transport.sendMail(mailOptions, function (error, response) {
    if (error) {
      console.log(error);
      return { status: "Error", msg: "Email Not Sent" };
    } else {
      return { status: "Ok", msg: "Email Sent Successfully" };
    }
  });
};

exports.senddetails =async function (user) {
  const currentUrl = process.env.CURRENT_URL;
  const uniqueString = uuidv4() + user.id;
  const verification = await Userverification.findOne({ user_id :user.id});
  mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: user.email,
    subject: "Verify Your Email",
    html: 
        `<p>
          Verify your email to complete the signup and login into your account.
        </p>
        <p>This link <b>expires in 15mins</b></p><p>click <a href=${currentUrl + "users/verify/" + user.id + "/" + uniqueString}>here</a> to proceed</p>`,  
  };
    //hash unique string
    bcrypt
    .hash(uniqueString,salt)
    .then((hashedstring)=>{
        const Verified= new Userverification({
            user_id:user.id,
            uniqueString:hashedstring,
            expiresAt: Date.now() + 900000,
        });
        Verified.save()
        .then(()=>{
            Transport.sendMail(mailOptions, function (error, response) {
                if (error) {
                  console.log(error);
                  return { status: "Error", msg: "Email Not Sent" };
                } else {
                  console.log("Email Sent Successfully");
                  return { status: "Pending", msg: " Verification Email Sent Successfully" };
                }
              });
        })
        .catch((error)=>{
            console.log(error)
            res.json({
                status:"Failed",
                message:"could not save verification data"
            })
        })
    })
    .catch(()=>{
        res.json({
            status:"Failed",
            message:"An error occured while hashing"
        })
    })
    
};

 exports.revalidateAccount = async (user) => {
  const verification = await Userverification.findOne({ user_id :user.id});

  if (!verification) {
    console.log("no user found")
    return;
  }

  if ( verification.expiresAt > Date.now()) {
    // token is still valid, send email with existing token
    console.log("token still fresh")
    try {
      mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: user.email,
        subject: "Verify Your Email",
        html: 
            `<p>
              Verify your email to complete the signup and login into your account.
            </p>
            <p>This link <b>expires in 15mins</b></p><p>click <a href=${currentUrl + "users/verify/" + user.id + "/" + verification.uniqueString}>here</a> to proceed</p>`,  
      };



      return Transport.sendMail(mailOptions, function (error, response) {
        if (error) {
          console.log(error);
          return { status: "Error", msg: "Email Not Sent" };
        } else {
          console.log("Email Sent Successfully");
          return { status: "Pending", msg: " Verification Email Sent Successfully" };
        }
      });
     
    } catch (error) {
      return { status: "Error", msg: "Email Not Sent" };
    }
   
    
  } else {
    //token has expired
    
    const uniqueString = uuidv4() + user.id;
    const currentUrl = process.env.CURRENT_URL;
    const hashstring=await bcrypt
    .hash(uniqueString,salt);
    verification.uniqueString=hashstring;
    verification.expiresAt =Date.now() + 900000;
    await verification.save();

    newMailOptions = {
      from: process.env.AUTH_EMAIL,
      to: user.email,
      subject: "Verify Your Email",
      html: 
          `<p>
            Verify your email to complete the signup and login into your account.
          </p>
          <p>This link <b>expires in 15mins</b></p><p>click <a href=${currentUrl + "users/verify/" + user.id + "/" + verification.uniqueString}>here</a> to proceed</p>`,  
    };

   return  Transport.sendMail(newMailOptions, function (error, response) {
      if (error) {
        console.log(error);
        return { status: "Error", msg: "Email Not Sent" };
      } else {
        console.log("Email Sent Successfully");
        return { status: "Pending", msg: " Verification Email Sent Successfully" };
      }
    });


  }
};


exports.updatepassword = function (data) {
  mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: data.email,
    subject: "Password Reset",
    text: "Your password has been reset Successfully!",
  };
  Transport.sendMail(mailOptions, function (error, response) {
    if (error) {
      console.log(error);
      return { status: "Error", msg: "Email Not Sent" };
    } else {
      console.log("Email Sent Successfully");
      return { status: "Ok", msg: "Email Sent Successfully" };
    }
  });
};

exports.generateCode = function (codeLength) {
  let randomCode = "";
  for (let i = 0; i < codeLength; i++) {
    randomNumber = Math.floor(Math.random() * 10);
    randomCode += randomNumber;
  }
  return randomCode;
};

exports.getChargeFee = async function (amount, currency) {
  try {
    let detail = { amount, currency };
    const flutter_fee = await flw.Transaction.fee(detail);
    const gain = flutter_fee.data.flutterwave_fee;
    return Number(gain);
  } catch (error) {
    console.log(error);
  }
};

exports.calculateTithe = async function (income_id, user_id, res) {
  try {
    const income = await Income.findById(income_id);
    if (income.user_id != user_id) {
      return res
        .status(400)
        .json({ msg: "User and income detail don't match" });
    }
    amount = Number(income.amount);
    percentage = Number(income.tithePercentage);
    const titheAmount = amount * (percentage / 100);
    return titheAmount;
  } catch (error) {
    console.error(error);
  }
};



exports.transferToChurch = async function(church,user,walett,amount,income){

  const transferData = {
    "account_bank": church.bank.code, 
    "account_number": church.accountNumber,
    "amount": amount,
    "email" : user.email,
    "narration": `Transfer from ${user.email} for ${church.name}`,
    "currency": income.currency,
    "debit_subaccount":walett.accountReference, //This is a merchant's unique reference for the transfer, it can be used to query 
}
const transferResponse = await api.post("/transfers", transferData);
return transferResponse;
}

