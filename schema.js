const { buildSchema } = require("graphql");

const schema = buildSchema(`
  type Course {
    id: ID!
    courseName: String!
    credit: Int!
  }

  type Student {
    id: ID!
    name: String!
    major: String!
    email: String!
    phone: String!
    courses: [Course!]!
  }

  type Query {
    student(id: ID!): Student
    students(major: String, sortBy: String): [Student!]!
    studentCount: Int!
    course(id: ID!): Course
    courses(minCredit: Int): [Course!]!
    searchStudents(keyword: String!): [Student!]!
  }

  input CreateStudentInput {
    name: String!
    major: String!
    email: String!
    phone: String!
    courseIds: [ID!]
  }

  input UpdateStudentInput {
    name: String
    major: String
    email: String
    phone: String
    courseIds: [ID!]
  }

  type DeleteResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    createStudent(input: CreateStudentInput!): Student!
    updateStudent(id: ID!, input: UpdateStudentInput!): Student
    deleteStudent(id: ID!): DeleteResult!
  }
`);

module.exports = schema;
