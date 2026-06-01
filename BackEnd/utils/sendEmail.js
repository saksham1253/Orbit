const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendLoginNotification = async (userEmail, userName) => {
    try {
        const mailOptions = {
            from: `"SkillSwap Security" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: 'New Login to SkillSwap',
            html: `
                <div style="font-family: 'Inter', sans-serif; background-color: #0f0a1c; color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid rgba(0, 198, 255, 0.2); max-width: 600px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);">
                    <h1 style="color: #00c6ff; text-align: center; font-size: 28px; margin-bottom: 10px;">SkillSwap</h1>
                    <h2 style="text-align: center; font-size: 20px; font-weight: 600; margin-bottom: 30px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 20px;">Security Alert</h2>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Hello <strong style="color: #ff0076;">${userName}</strong>,
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Login Successful! We noticed a new login to your SkillSwap account.
                    </p>
                    
                    <div style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 30px;">
                        <p style="margin: 0; font-size: 14px; color: #b3b3b3;">
                            <strong>Time:</strong> ${new Date().toLocaleString()}<br>
                        </p>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        <strong>Security Message:</strong> If this login was done by you, you can safely ignore this email. If this login was NOT done by you, please secure your account and change your password immediately.
                    </p>
                    
                    <p style="font-size: 14px; color: #888888; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px;">
                        Stay secure,<br>
                        The SkillSwap Team
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Login notification sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending login notification:", error);
    }
};

exports.sendRegistrationNotification = async (userEmail, userName) => {
    try {
        const mailOptions = {
            from: `"SkillSwap Welcome" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: 'Welcome to SkillSwap!',
            html: `
                <div style="font-family: 'Inter', sans-serif; background-color: #0f0a1c; color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid rgba(0, 198, 255, 0.2); max-width: 600px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);">
                    <h1 style="color: #00c6ff; text-align: center; font-size: 28px; margin-bottom: 10px;">SkillSwap</h1>
                    <h2 style="text-align: center; font-size: 20px; font-weight: 600; margin-bottom: 30px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 20px;">Welcome Aboard!</h2>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Hello <strong style="color: #ff0076;">${userName}</strong>,
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Welcome to SkillSwap! We are absolutely thrilled to have you join our peer-to-peer learning community. 
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        Get ready to share your knowledge, discover incredible new skills, and connect with brilliant people around you. Your journey starts now, and we wish you a wonderful and enriching experience!
                    </p>
                    
                    <p style="font-size: 14px; color: #888888; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px;">
                        Warmest regards,<br>
                        The SkillSwap Team
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Registration notification sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending registration notification:", error);
    }
};
