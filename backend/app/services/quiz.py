import os
import shutil
from datetime import datetime
from mimetypes import guess_type
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

import app.api.schemas.quiz as QuizSchemas
import app.core.exceptions as Error
import app.database.models as models
from app.services.enrollment import EnrollmentService


class QuizService:
    def __init__(self, session: AsyncSession, enrollment: EnrollmentService):
        self.session = session
        self.enrollment = enrollment

    async def create_quiz(self, lesson_id: int, quiz_data: QuizSchemas.QuizCreate, instructor: models.Instructor) -> QuizSchemas.QuizRead:
        # Getting lesson from database
        lesson = await self._get_lesson(lesson_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, lesson.module.course)

        # If lesson type is not quiz
        if lesson.content_type != models.ContentType.quiz:
            raise Error.InvalidLessonTypeError()

        # If quiz is already found
        existing = (
            await self.session.execute(select(models.Quiz).where(models.Quiz.lesson_id == lesson_id))
        ).scalar_one_or_none()

        if existing:
            raise Error.QuizAlreadyExistsError()

        # Creating a quiz model
        quiz = models.Quiz(title=quiz_data.title, lesson_id=lesson_id)

        # Adding the quiz to database
        self.session.add(quiz)

        # Applying changes
        await self.session.commit()

        # Getting quiz info
        await self.session.refresh(quiz)

        # Creating the quiz directory
        self._quiz_dir(lesson).mkdir(parents=True, exist_ok=True)

        # Returning the quiz info
        return self._quiz_read(quiz)

    async def get_quiz_for_lesson(self, lesson_id: int, user: dict) -> QuizSchemas.QuizRead | QuizSchemas.QuizReadPublic:
        # Getting lesson from database
        lesson = await self._get_lesson(lesson_id)

        # Storing the course
        course = lesson.module.course

        # Verify user has access
        self._verify_access(UUID(user["user_id"]), user["user_role"], course)

        # Getting quiz from database
        quiz = await self._get_quiz_by_lesson(lesson_id)

        # If user is a student
        if user["user_role"] == models.Roles.student:
            # Getting student from database
            student = await self.session.get(models.Student, UUID(user["user_id"]))

            # If student is not found
            if not student:
                raise Error.UserNotFoundError(user["user_id"])
            
            # If student is not enrolled in course
            if await self.enrollment.check_enrollment_status(course.id, student) == models.Status.unenrolled:
                raise Error.EnrollmentNotFoundError()
            
            # Changing the progress status for the lesson
            await self.enrollment.mark_as_in_progress(lesson, student)

            # Returning quiz info for students
            return self._quiz_read_public(quiz)

        # Returning quiz info
        return self._quiz_read(quiz)

    async def update_quiz(self, quiz_id: int, quiz_data: QuizSchemas.QuizUpdate, instructor: models.Instructor) -> QuizSchemas.QuizRead:
        # Getting quiz from database
        quiz = await self._get_quiz(quiz_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, quiz.lesson.module.course) # type: ignore

        # updating the quiz in database
        quiz.sqlmodel_update(quiz_data.model_dump(exclude_none=True))

        # Applying changes
        await self.session.commit()

        # Returning quiz info
        return self._quiz_read(quiz)

    async def delete_quiz(self, quiz_id: int, instructor: models.Instructor) -> None:
        # Getting quiz from database
        quiz = await self._get_quiz(quiz_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, quiz.lesson.module.course)  # type: ignore

        # Getting the quiz directory
        quiz_dir = self._quiz_dir(quiz.lesson)  # type: ignore

        # Deleting the quiz from database
        await self.session.delete(quiz)

        # Applying changes
        await self.session.commit()

        # Deleting the quiz directory
        if quiz_dir.exists():
            shutil.rmtree(quiz_dir)

    async def add_question(
        self, 
        quiz_id: int, 
        question_data: QuizSchemas.QuestionCreate, 
        instructor: models.Instructor
    ) -> QuizSchemas.QuestionRead:
        # Getting quiz from database
        quiz = await self._get_quiz(quiz_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, quiz.lesson.module.course)  # type: ignore

        # Assigning new order index for the question
        order_index = len(quiz.questions) + 1

        # Creating a question model
        question = models.Question(text=question_data.text, order_index=order_index, quiz_id=quiz_id)

        # Adding the question to database
        self.session.add(question)

        # Applying changes
        await self.session.commit()

        # Getting question info
        await self.session.refresh(question)

        # Returning question info
        return self._question_read(question)

    async def update_question(
        self, 
        question_id: int, 
        question_data: QuizSchemas.QuestionUpdate, 
        instructor: models.Instructor
    ) -> QuizSchemas.QuestionRead:
        # Getting question from database
        question = await self._get_question(question_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, question.quiz.lesson.module.course)  # type: ignore

        # Updating the question in database
        question.sqlmodel_update(question_data.model_dump(exclude_none=True))

        # Applying changes
        await self.session.commit()

        # Returning question info
        return self._question_read(question)

    async def upload_question_image(self, question_id: int, file: UploadFile, instructor: models.Instructor) -> QuizSchemas.QuestionRead:
        # Getting question from database
        question = await self._get_question(question_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, question.quiz.lesson.module.course)  # type: ignore

        # Getting file extension and validating the image is correct format and size
        extension = self._validate_image(file)

        # Creating the file path
        file_path = self._quiz_dir(question.quiz.lesson) / f"q{question_id}{extension}"  # type: ignore

        # Saving the file
        await self._save_file(file_path, file)

        # Over writing the old question image
        if question.image_url:
            old = Path(question.image_url)
            if old.exists():
                os.remove(old)

        # Adding the image of the question url to the database
        question.image_url = str(file_path)

        # Applying changes
        await self.session.commit()

        # Returning question info
        return self._question_read(question)

    async def delete_question_image(self, question_id: int, instructor: models.Instructor) -> QuizSchemas.QuestionRead:
        # Getting question from database
        question = await self._get_question(question_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, question.quiz.lesson.module.course)  # type: ignore

        # Getting the image of the question url
        file_url = question.image_url

        # Updating the question image url to None
        question.sqlmodel_update({"image_url": None})

        # Applying changes
        await self.session.commit()

        # Deleting the file from storage
        if file_url:
            path = Path(file_url)
            if path.exists():
                os.remove(path)
        else: # If file is not uploaded
            raise Error.NoFileUploadedError()

        # Returning question info
        return self._question_read(question)

    async def get_question_image(self, question_id: int, user: dict) -> FileResponse:
        # Getting question from database
        question = await self._get_question(question_id)

        # Verifying user has access to the course
        self._verify_access(UUID(user["user_id"]), user["user_role"], question.quiz.lesson.module.course)  # type: ignore

        # If no image was found
        if not question.image_url:
            raise Error.NoFileUploadedError()

        # Getting the image path
        file = Path(question.image_url)

        # Returning the file
        return FileResponse(path=file, filename=file.name, media_type=guess_type(file)[0])

    async def delete_question(self, question_id: int, instructor: models.Instructor) -> None:
        # Getting question from database
        question = await self._get_question(question_id)
        
        # Getting quiz of the question
        quiz = question.quiz

        # Verifying instructor owns the course
        self._verify_instructor_owns_course(instructor, quiz.lesson.module.course)  # type: ignore

        # Deleting question image if found
        if question.image_url:
            path = Path(question.image_url)
            if path.exists():
                os.remove(path)

        # Deleting question from database
        await self.session.delete(question)

        # Applying changes
        await self.session.commit()

        # Getting quiz info
        await self.session.refresh(quiz)
        
        # Updating the order of index for the rest of question
        for i, q in enumerate(quiz.questions): # type: ignore
            q.sqlmodel_update({"order_index": i + 1})

        # Applying changes
        await self.session.commit()

    async def add_answer(
            self, 
            question_id: int, 
            answer_data: QuizSchemas.AnswerCreate, 
            instructor: models.Instructor
            ) -> QuizSchemas.AnswerRead:
        # Getting question from database
        question = await self._get_question(question_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, question.quiz.lesson.module.course)  # type: ignore

        # Limiting the number of answers to only 4
        if len(question.answers) >= 4:
            raise Error.MaxAnswersReachedError()

        # Preventing more than one correct answer per question
        if answer_data.is_correct and any(a.is_correct for a in question.answers):
            raise Error.MultipleCorrectAnswersError()

        # Creating an answer model
        answer = models.Answer(
            text=answer_data.text,
            is_correct=answer_data.is_correct,
            question_id=question_id,
        )

        # Adding answer to database
        self.session.add(answer)

        # Applying changes
        await self.session.commit()

        # Getting answer info
        await self.session.refresh(answer)

        # Returning answer info
        return self._answer_read(answer)

    async def update_answer(
            self, 
            answer_id: int, 
            answer_data: QuizSchemas.AnswerUpdate, 
            instructor: models.Instructor
            ) -> QuizSchemas.AnswerRead:
        # Getting answer from database
        answer = await self._get_answer(answer_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, answer.question.quiz.lesson.module.course)  # type: ignore

        # Preventing more than one correct answer per question
        if answer_data.is_correct and not answer.is_correct:
            other_correct = any(a.is_correct for a in answer.question.answers if a.id != answer_id)  # type: ignore
            if other_correct:
                raise Error.MultipleCorrectAnswersError()

        # Updating the answer in database
        answer.sqlmodel_update(answer_data.model_dump(exclude_none=True))

        # Applying changes
        await self.session.commit()

        # Returning the answer info
        return self._answer_read(answer)

    async def upload_answer_image(self, answer_id: int, file: UploadFile, instructor: models.Instructor) -> QuizSchemas.AnswerRead:
        # Getting answer from database
        answer = await self._get_answer(answer_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, answer.question.quiz.lesson.module.course) # type: ignore

        # Getting the file extension and validating the file for correct format and size
        extension = self._validate_image(file)

        # Constructing the file path
        file_path = self._quiz_dir(answer.question.quiz.lesson) / f"a{answer_id}{extension}" # type: ignore

        # Saving the file to storage
        await self._save_file(file_path, file)

        # Deleting the old image of it exists
        if answer.image_url:
            old = Path(answer.image_url)
            if old.exists():
                os.remove(old)

        # Updating the image url in database
        answer.image_url = str(file_path)

        # Applying changes
        await self.session.commit()

        # Returning answer info
        return self._answer_read(answer)

    async def delete_answer_image(self, answer_id: int, instructor: models.Instructor) -> QuizSchemas.AnswerRead:
        # Getting answer from database
        answer = await self._get_answer(answer_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, answer.question.quiz.lesson.module.course) # type: ignore

        # Getting the image url
        file_url = answer.image_url

        # Updating the answer image url to None
        answer.sqlmodel_update({"image_url": None})

        # Applying changes
        await self.session.commit()

        # Deleting the image file
        if file_url:
            path = Path(file_url)
            if path.exists():
                os.remove(path)
        else:
            raise Error.NoFileUploadedError()

        # Returning the answer info
        return self._answer_read(answer)

    async def get_answer_image(self, answer_id: int, user: dict) -> FileResponse:
        # Getting answer from database
        answer = await self._get_answer(answer_id)

        # Verifying instructor is the owner of the course
        self._verify_access(UUID(user["user_id"]), user["user_role"], answer.question.quiz.lesson.module.course) # type: ignore

        # Checking if image is provided
        if not answer.image_url:
            raise Error.NoFileUploadedError()

        # Getting the file path
        file = Path(answer.image_url)

        # Returning the file path
        return FileResponse(path=file, filename=file.name, media_type=guess_type(file)[0])

    async def delete_answer(self, answer_id: int, instructor: models.Instructor) -> None:
        # Getting answer from database
        answer = await self._get_answer(answer_id)

        # Verifying instructor is the owner of the course
        self._verify_instructor_owns_course(instructor, answer.question.quiz.lesson.module.course) # type: ignore

        # Deleting answer image url if exist
        if answer.image_url:
            path = Path(answer.image_url)
            if path.exists():
                os.remove(path)

        # Deleting answer from the database
        await self.session.delete(answer)

        # Applying changes
        await self.session.commit()

    async def submit_quiz(self, quiz_id: int, submission: QuizSchemas.QuizSubmit, student: models.Student) -> QuizSchemas.QuizResult:
        # Getting quiz from database
        quiz = await self._get_quiz(quiz_id)

        # Getting the course which the quiz belongs to
        course = quiz.lesson.module.course # type: ignore

        # Checking student is enrolled in course
        if await self.enrollment.check_enrollment_status(course.id, student) == models.Status.unenrolled:
            raise Error.EnrollmentNotFoundError()

        # Generating a set of all question ids
        quiz_question_ids = {q.id for q in quiz.questions}

        # Generating a set of al the submitted question ids
        submitted_question_ids = {a.question_id for a in submission.answers}

        # Checking if the are both identical
        if quiz_question_ids != submitted_question_ids:
            raise Error.InvalidQuizSubmissionError()

        # Initializing variable to count correct answers
        correct_count = 0

        # List to record attempts
        attempt_answers = []

        # Looping over the submitted answers
        for submitted in submission.answers:
            # Getting answer from database
            answer = await self._get_answer(submitted.answer_id)

            # If answer question does not match answer question submitted
            if answer.question_id != submitted.question_id:
                raise Error.InvalidQuizSubmissionError()
            
            # If answer is correct
            if answer.is_correct:
                # Increasing the number of correct answers by 1
                correct_count += 1

            # Creating Attempt answer result schema and adding it to the list
            attempt_answers.append(
                QuizSchemas.AttemptAnswerResult(
                    question_id=submitted.question_id,
                    selected_answer_id=submitted.answer_id,
                    is_correct=answer.is_correct,
                )
            )

        # Getting the total number of questions
        total = len(quiz.questions)
        
        # Calculating the score
        score = round((correct_count / total * 100) if total > 0 else 0.0, 2)

        # Getting old attempt
        existing = (
            await self.session.execute(
                select(models.QuizAttempt).where(
                    models.QuizAttempt.quiz_id == quiz_id,
                    models.QuizAttempt.student_id == student.id,
                )
            )
        ).scalar_one_or_none()

        # If there is an old attempt
        if existing:
            # Delete old attempt from database
            await self.session.delete(existing)

            # Applying changes
            await self.session.commit()

        # Getting the current time
        now = datetime.now()

        # Creating a quiz attempt model
        attempt = models.QuizAttempt(score=score, submitted_at=now, student_id=student.id, quiz_id=quiz_id)

        # Adding the attempt to database
        self.session.add(attempt)

        # Applying changes
        await self.session.commit()

        # Getting attempt info
        await self.session.refresh(attempt)

        # Adding attempts answer to database
        for aa in attempt_answers:
            self.session.add(
                models.AttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=aa.question_id,
                    selected_answer_id=aa.selected_answer_id,
                )
            )
        
        # Applying changes
        await self.session.commit()

        # Mark lesson completed only on passing grade is 70 or higher, downgrade to in_progress otherwise
        if score >= 70.0:
            await self.enrollment.mark_as_completed(quiz.lesson_id, student)
        else:
            await self.enrollment.mark_quiz_as_in_progress(quiz.lesson_id, student)

        # Returning quiz result
        return QuizSchemas.QuizResult(
            quiz_id=quiz_id,
            score=score,
            total_questions=total,
            correct_count=correct_count,
            submitted_at=now,
            answers=attempt_answers,
        )

    async def get_quiz_result(self, quiz_id: int, student: models.Student) -> QuizSchemas.QuizResult:
        # Getting quiz from database
        quiz = await self._get_quiz(quiz_id)

        # Getting the course which quiz belongs to
        course = quiz.lesson.module.course # type: ignore

        # Checking student is enrolled in course
        if await self.enrollment.check_enrollment_status(course.id, student) == models.Status.unenrolled:
            raise Error.EnrollmentNotFoundError()

        # Getting the student attempt
        attempt = (
            await self.session.execute(
                select(models.QuizAttempt).where(
                    models.QuizAttempt.quiz_id == quiz_id,
                    models.QuizAttempt.student_id == student.id,
                )
            )
        ).scalar_one_or_none()

        # If attempt is not found
        if not attempt:
            raise Error.QuizAttemptNotFoundError()

        # list to store answer results
        answer_results = []

        # Variables to store the correct answers count
        correct_count = 0

        # Looping over all the selected answers
        for aa in attempt.selected_answers:
            # Getting answer from database
            answer = await self.session.get(models.Answer, aa.selected_answer_id)

            # If student selected answer is correct
            is_correct = answer.is_correct if answer else False
            if is_correct:
                correct_count += 1

            # Recording the answer attempt
            answer_results.append(
                QuizSchemas.AttemptAnswerResult(
                    question_id=aa.question_id,
                    selected_answer_id=aa.selected_answer_id,
                    is_correct=is_correct,
                )
            )

        # Retuning the quiz result info
        return QuizSchemas.QuizResult(
            quiz_id=quiz_id,
            score=attempt.score,
            total_questions=len(quiz.questions),
            correct_count=correct_count,
            submitted_at=attempt.submitted_at,
            answers=answer_results,
        )

    async def _get_lesson(self, lesson_id: int) -> models.Lesson:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson is not found
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)
        
        # Returning the lesson
        return lesson

    async def _get_quiz(self, quiz_id: int) -> models.Quiz:
        # Getting quiz from database
        quiz = await self.session.get(models.Quiz, quiz_id)

        # If quiz is not found
        if not quiz:
            raise Error.QuizNotFoundError(quiz_id)
        
        # Returning the quiz
        return quiz

    async def _get_quiz_by_lesson(self, lesson_id: int) -> models.Quiz:
        # Getting quiz from database
        quiz = (
            await self.session.execute(select(models.Quiz).where(models.Quiz.lesson_id == lesson_id))
        ).scalar_one_or_none()

        # If quiz is not found
        if not quiz:
            raise Error.QuizNotFoundError(lesson_id)
        
        # Returning the quiz
        return quiz

    async def _get_question(self, question_id: int) -> models.Question:
        # Getting question from database
        question = await self.session.get(models.Question, question_id)

        # If question is not found
        if not question:
            raise Error.QuestionNotFoundError(question_id)
        
        # Returning thw question
        return question

    async def _get_answer(self, answer_id: int) -> models.Answer:
        # Getting answer from database
        answer = await self.session.get(models.Answer, answer_id)

        # If answer is not found
        if not answer:
            raise Error.AnswerNotFoundError(answer_id)
        
        # Returning the answer
        return answer

    def _quiz_dir(self, lesson: models.Lesson) -> Path:
        # Returning the quiz path
        return Path(
            f"storage/courses/course_{lesson.module.course_id}"
            f"/module_{lesson.module_id}/lesson_{lesson.id}/quiz"
        )

    def _verify_instructor_owns_course(self, instructor: models.Instructor, course: models.Course) -> None:
        # Checking if instructor id matches the course instructor owner
        if course.instructor_id != instructor.id:
            raise Error.DeniedAccessError()

    def _verify_access(self, user_id: UUID, role: models.Roles, course: models.Course) -> None:
        # If user is an admin
        if role == models.Roles.administrator:
            return
        
        # If user is an instructor
        if role == models.Roles.instructor:
            # Verifying instructor of the course is the active user
            if course.instructor_id != user_id:
                raise Error.DeniedAccessError()
            
        elif role == models.Roles.student: # If user is a student
            # Verifying if the course if published
            if not course.published:
                raise Error.CourseNotFoundError(course.id)

    def _validate_image(self, file: UploadFile) -> str:
        # If no file is uploaded
        if not file.filename:
            raise Error.NoFileUploadedError()
        
        # Getting file extension
        extension = Path(file.filename).suffix.lower()

        # Allowable file formats
        allowed_ext = [".jpg", ".jpeg", ".png"]
        allowed_types = ["image/jpeg", "image/jpg", "image/png"]

        # Checking for allowed file extension and content_type
        if extension not in allowed_ext or file.content_type not in allowed_types:
            raise Error.InvalidFileFormatError(extension)
        
        # Max file size
        MAX_SIZE = 5 * 1024 * 1024

        # Verifying that file size is less than max size
        if file.size and file.size > MAX_SIZE:
            raise Error.FileSizeTooLarge(MAX_SIZE)
        
        # Returning file extension
        return extension

    async def _save_file(self, file_path: Path, file: UploadFile) -> None:
        # Reading the file
        content = await file.read()

        # Writing the file to storage
        with open(file_path, "wb") as f:
            f.write(content)

    def _answer_read(self, answer: models.Answer) -> QuizSchemas.AnswerRead:
        # Constructing answer read schema
        return QuizSchemas.AnswerRead(
            id=answer.id,
            text=answer.text,
            image_url=answer.image_url,
            is_correct=answer.is_correct,
            question_id=answer.question_id,
        )

    def _answer_read_public(self, answer: models.Answer) -> QuizSchemas.AnswerReadPublic:
        # Constructing answer read public schema
        return QuizSchemas.AnswerReadPublic(
            id=answer.id,
            text=answer.text,
            image_url=answer.image_url,
            question_id=answer.question_id,
        )

    def _question_read(self, question: models.Question) -> QuizSchemas.QuestionRead:
        # Constructing question read schema
        return QuizSchemas.QuestionRead(
            id=question.id,
            text=question.text,
            image_url=question.image_url,
            order_index=question.order_index,
            quiz_id=question.quiz_id,
            answers=[self._answer_read(a) for a in question.answers],
        )

    def _question_read_public(self, question: models.Question) -> QuizSchemas.QuestionReadPublic:
        # Constructing answer read public schema
        return QuizSchemas.QuestionReadPublic(
            id=question.id,
            text=question.text,
            image_url=question.image_url,
            order_index=question.order_index,
            quiz_id=question.quiz_id,
            answers=[self._answer_read_public(a) for a in question.answers],
        )

    def _quiz_read(self, quiz: models.Quiz) -> QuizSchemas.QuizRead:
        # Constructing quiz read schema        
        return QuizSchemas.QuizRead(
            id=quiz.id,
            title=quiz.title,
            lesson_id=quiz.lesson_id,
            questions=[self._question_read(q) for q in quiz.questions],
        )

    def _quiz_read_public(self, quiz: models.Quiz) -> QuizSchemas.QuizReadPublic:
        # Constructing quiz read  public schema
        return QuizSchemas.QuizReadPublic(
            id=quiz.id,
            title=quiz.title,
            lesson_id=quiz.lesson_id,
            questions=[self._question_read_public(q) for q in quiz.questions],
        )
