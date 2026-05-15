const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create a transporter
    const transporter = nodemailer.createTransport({
        service: 'Gmail', // You can change this if using Outlook, Yahoo, or a custom SMTP
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // 2. Define the email options
    const mailOptions = {
        from: 'SecureExam Portal <no-reply@secureexam.com>',
        to: options.email,
        subject: options.subject,
        html: options.message
    };

    // 3. Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
