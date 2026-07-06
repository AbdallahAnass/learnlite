class AppException(Exception):
    """Base class Error"""
    
    def __init__(self, message: str):
        self.message = message

        super().__init__(message)


class UserAlreadyExistsError(AppException):
    """Error raise when Email already exists"""

    def __init__(self, email: str):
        super().__init__(
            message=f"User with email {email} already exists",
        )


class InvalidCredentialsError(AppException):
    """Raised when email or password are incorrect"""
    
    def __init__(self):
        super().__init__(
            message="Email or password are invalid"
            )

class AdminAccountCreationError(AppException):
    """Raised when trying to create an admin account"""

    def __init__(self):
        super().__init__(message="Creating admin account is restricted")

class DuplicatedCourseNameError(AppException):
    """Raised when trying to create a course with already existing course title"""

    def __init__(self, title):
        super().__init__(message=f"Course with title '{title}' already exists")

class DuplicatedModuleTitleError(AppException):
    """Raised when trying to create a Module with already existing title"""

    def __init__(self, title):
        super().__init__(message=f"Module with title '{title}' already exists in the course")

class DuplicatedLessonTitleError(AppException):
    """Raised when trying to create a Lesson with already existing title"""

    def __init__(self, title):
        super().__init__(message=f"Lesson with title '{title}' already exists in the module")

class NoFileUploadedError(AppException):
    """Raised when no file is uploaded"""

    def __init__(self):
        super().__init__(message="No file is uploaded")

class InvalidFileFormatError(AppException):
    """Raised when invalid file format is uploaded"""

    def __init__(self, format):
        super().__init__(message=f"File format '{format}' is not supported")

class FileSizeTooLarge(AppException):
    """Raised the file size is too big"""

    def __init__(self, max_limit):
        super().__init__(message=f"File size too big, please upload a file less than or equal to {max_limit / 1024 / 1024} MB")

class CourseNotFoundError(AppException):
    """Raised when trying to access an invalid course id"""

    def __init__(self, id):
        super().__init__(message=f"Course with id: {id} not found")

class ModuleNotFoundError(AppException):
    """Raised when trying to access a module that does not exist"""

    def __init__(self, id):
        super().__init__(message=f"Module with id: {id} not found")

class LessonNotFoundError(AppException):
    """Raised when trying to access a lesson that does not exist"""

    def __init__(self, id):
        super().__init__(message=f"Lesson with id: {id} not found")

class InstructorDoesNotExist(AppException):
    """Raised when instructor does not exist"""

    def __init__(self, id):
        super().__init__(message=f"Instructor with id: {id} does not exist")
    
class InvalidOrderError(AppException):
    """Raised when an invalid order is provided"""

    def __init__(self):
        super().__init__(message="Order invalid. Please enter a valid order")

class CourseNotPublishedError(AppException):
    """Raised when trying to access an unpublished course"""

    def __init__(self, course_id):
        super().__init__(message=f"Course with id {course_id} is not published yet")

class DeniedAccessError(AppException):
    """Raised when user does not have permission to access"""

    def __init__(self):
        super().__init__(message="Denied access, user does not have permission")
    
class DuplicatedEnrollmentError(AppException):
    """Raised when student tries to enroll in a course with active enrollment"""

    def __init__(self):
        super().__init__(message="Student already Enrolled in course")
    

class EnrollmentNotFoundError(AppException):
    """Raised when trying to access an enrollment that does not exist"""

    def __init__(self):
        super().__init__(message="Enrollment not found")

class UserNotFoundError(AppException):
    """Raised when user not found"""

    def __init__(self, id):
        super().__init__(message="User with id: {id} not found")


class QuizNotFoundError(AppException):
    """Raised when a quiz is not found"""

    def __init__(self, id):
        super().__init__(message=f"Quiz with id: {id} not found")


class QuizAlreadyExistsError(AppException):
    """Raised when a lesson already has a quiz"""

    def __init__(self):
        super().__init__(message="This lesson already has a quiz")


class InvalidLessonTypeError(AppException):
    """Raised when trying to create a quiz for a non-quiz lesson"""

    def __init__(self):
        super().__init__(message="Quizzes can only be created for lessons of type 'quiz'")


class QuestionNotFoundError(AppException):
    """Raised when a question is not found"""

    def __init__(self, id):
        super().__init__(message=f"Question with id: {id} not found")


class AnswerNotFoundError(AppException):
    """Raised when an answer is not found"""

    def __init__(self, id):
        super().__init__(message=f"Answer with id: {id} not found")


class MaxAnswersReachedError(AppException):
    """Raised when trying to add more than 4 answers to a question"""

    def __init__(self):
        super().__init__(message="A question can have at most 4 answers")


class QuizAttemptNotFoundError(AppException):
    """Raised when a student has no quiz attempt recorded"""

    def __init__(self):
        super().__init__(message="No quiz attempt found for this student")


class InvalidQuizSubmissionError(AppException):
    """Raised when a quiz submission is invalid"""

    def __init__(self):
        super().__init__(message="Invalid submission: answers must cover all quiz questions with valid answer IDs")


class MultipleCorrectAnswersError(AppException):
    """Raised when trying to mark a second answer as correct for the same question"""

    def __init__(self):
        super().__init__(message="A question can only have one correct answer")


class NotEnrolledError(AppException):
    """Raised when a student tries to perform an action that requires enrollment"""

    def __init__(self):
        super().__init__(message="You must be enrolled in this course to perform this action")


class ReviewNotFoundError(AppException):
    """Raised when a review is not found"""

    def __init__(self, id):
        super().__init__(message=f"Review with id: {id} not found")


class ReviewAlreadyExistsError(AppException):
    """Raised when a student tries to review a course they already reviewed"""

    def __init__(self):
        super().__init__(message="You have already submitted a review for this course")


class CourseNotReadyToPublishError(AppException):
    """Raised when a course doesn't meet the publishing requirements"""

    def __init__(self, issues: list[str]):
        self.issues = issues
        super().__init__(message="\n".join(issues))
