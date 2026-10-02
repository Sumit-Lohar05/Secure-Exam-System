const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const senderAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'SecureExam Portal <no-reply@secureexam.com>';

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
        from: senderAddress,
        to: options.email,
        subject: options.subject,
        html: options.message
    };

    // 3. Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
