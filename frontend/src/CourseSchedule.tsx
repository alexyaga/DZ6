import React, { useState } from "react";
import { Plus, Pencil, CalendarDays, BookOpen, Clock3 } from "lucide-react";
import { money, date, fmt } from "./api";
import { Badge, Empty } from "./shared";

export function AdminLessonTable({
  lessons,
  topics,
  courses,
  teachers,
  onEdit,
  showCourse = true,
}: any) {
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            {showCourse && <th>Курс</th>}
            <th>Тема урока</th>
            <th>Дата и время · МСК</th>
            <th>Преподаватель</th>
            <th>Формат и стоимость</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson: any) => (
            <tr key={lesson.id}>
              {showCourse && (
                <td>
                  <strong>
                    {courses.find((c: any) => c.id === lesson.course_id)
                      ?.title || `Курс #${lesson.course_id}`}
                  </strong>
                  <small>Занятие #{lesson.id}</small>
                </td>
              )}
              <td>
                <strong>
                  {topics.find((t: any) => t.id === lesson.topic_id)?.title ||
                    `Тема #${lesson.topic_id}`}
                </strong>
              </td>
              <td>
                <strong>{date(lesson.starts_at, true)}</strong>
                <small>
                  До{" "}
                  {new Date(lesson.ends_at + "Z").toLocaleTimeString("ru-RU", {
                    timeZone: "Europe/Moscow",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ·{" "}
                  {Math.round(
                    (Date.parse(lesson.ends_at + "Z") -
                      Date.parse(lesson.starts_at + "Z")) /
                      60000,
                  )}{" "}
                  мин.
                </small>
              </td>
              <td>
                {teachers.find((t: any) => t.id === lesson.teacher_id)?.name ||
                  `Преподаватель #${lesson.teacher_id}`}
              </td>
              <td>
                {fmt(lesson.format)}
                <small>
                  Мест: {lesson.capacity} · {money(lesson.price)}
                </small>
              </td>
              <td>
                <Badge value={lesson.status} />
              </td>
              <td>
                <button
                  aria-label="Редактировать занятие"
                  title="Редактировать занятие"
                  onClick={() => onEdit(lesson)}
                >
                  <Pencil size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!lessons.length && (
        <Empty
          title="Занятий пока нет"
          text="Добавьте занятие или выберите другой период."
        />
      )}
    </div>
  );
}

export function CourseSchedule({
  course,
  topics,
  school,
  onAddLesson,
  onEditLesson,
  onAddTopic,
  onEditTopic,
}: any) {
  const [period, setPeriod] = useState("upcoming");
  const courseTopics = topics
    .filter((t: any) => t.course_id === course.id)
    .sort((a: any, b: any) => a.position - b.position || a.id - b.id);
  const allLessons = school.lessons.filter(
    (l: any) => l.course_id === course.id,
  );
  const now = Date.now();
  const lessons = allLessons
    .filter(
      (l: any) =>
        period === "all" ||
        (period === "upcoming"
          ? l.status === "scheduled" && Date.parse(l.ends_at + "Z") > now
          : period === "cancelled"
            ? l.status === "cancelled"
            : l.status !== "cancelled" && Date.parse(l.ends_at + "Z") <= now),
    )
    .sort((a: any, b: any) =>
      period === "past"
        ? b.starts_at.localeCompare(a.starts_at)
        : a.starts_at.localeCompare(b.starts_at),
    );
  return (
    <>
      <section className="panel course-admin-summary">
        <p>{course.description || "Описание курса пока не добавлено."}</p>
        <div>
          <span>
            <BookOpen size={16} />
            Тем в программе: {courseTopics.length}
          </span>
          <span>
            <CalendarDays size={16} />
            Предстоящих занятий:{" "}
            {
              allLessons.filter(
                (l: any) =>
                  l.status === "scheduled" && Date.parse(l.ends_at + "Z") > now,
              ).length
            }{" "}
          </span>
          <span>{course.level}</span>
          <span>{money(course.price)}</span>
          <span className="badge">
            {course.active ? "Активный курс" : "Архив"}
          </span>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>Программа курса</h2>
          <button
            className="secondary compact"
            onClick={() =>
              onAddTopic({
                course_id: course.id,
                position:
                  Math.max(0, ...courseTopics.map((t: any) => t.position)) + 1,
              })
            }
          >
            <Plus size={16} />
            Добавить тему
          </button>
        </div>
        <div className="panel course-topic-list">
          {courseTopics.map((topic: any) => (
            <div className="topic-admin" key={topic.id}>
              <span>
                <b>{topic.position.toString().padStart(2, "0")}</b>
                {topic.title}
              </span>
              <button
                aria-label={`Изменить тему: ${topic.title}`}
                onClick={() => onEditTopic(topic)}
              >
                <Pencil size={16} />
              </button>
            </div>
          ))}
          {!courseTopics.length && (
            <Empty
              title="Программа пока не составлена"
              text="Добавьте темы, чтобы планировать занятия по этому курсу."
            />
          )}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>Расписание курса</h2>
          <button
            className="primary compact"
            disabled={!courseTopics.length}
            onClick={onAddLesson}
          >
            <Plus size={16} />
            Добавить занятие
          </button>
        </div>
        {!courseTopics.length && (
          <p className="muted course-schedule-hint">
            Перед созданием занятия добавьте хотя бы одну тему курса.
          </p>
        )}
        <div className="toolbar">
          <div className="tabs" role="group" aria-label="Период расписания">
            {[
              ["upcoming", "Предстоящие"],
              ["past", "Прошедшие"],
              ["cancelled", "Отменённые"],
              ["all", "Все занятия"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={period === value ? "selected" : ""}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="muted course-schedule-hint">
            <Clock3 size={14} />
            Московское время · {lessons.length} занятий
          </span>
        </div>
        <AdminLessonTable
          lessons={lessons}
          topics={topics}
          courses={school.courses}
          teachers={school.teachers}
          onEdit={onEditLesson}
          showCourse={false}
        />
      </section>
    </>
  );
}
