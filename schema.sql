CREATE DATABASE IF NOT EXISTS student_api;
USE student_api;

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  major VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_name VARCHAR(150) NOT NULL,
  credit INT NOT NULL,
  seat_available INT NOT NULL DEFAULT 30
);

CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_enrollment (student_id, course_id)
);
