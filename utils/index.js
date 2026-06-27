
const sendSuccess = (res, statusCode = 200, message = "Success", data = {}) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

const sendError = (res, statusCode = 500, message = "Internal Server Error", error = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error?.message || error || null,
    });
};

const handleValidationError = (res, error) => {
    if (error.name === "ValidationError" && Array.isArray(error.errors)) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: error.errors, // All detailed messages from yup
        });
    }

    return res.status(400).json({
        success: false,
        message: error.message || "Invalid input data.",
    });
};

module.exports = {
    sendSuccess,
    sendError,
    handleValidationError
}