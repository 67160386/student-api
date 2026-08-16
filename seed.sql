USE student_api;

INSERT INTO students (name, major, email) VALUES
  ('สมชาย ใจดี', 'วิทยาการคอมพิวเตอร์', 'somchai@example.com'),
  ('สมหญิง รักเรียน', 'เทคโนโลยีสารสนเทศ', 'somying@example.com');

INSERT INTO courses (course_name, credit, seat_available) VALUES
  ('การเขียนโปรแกรมเบื้องต้น', 3, 30),
  ('โครงสร้างข้อมูล', 3, 25);

INSERT INTO enrollments (student_id, course_id) VALUES
  (1, 1),
  (1, 2),
  (2, 2);
