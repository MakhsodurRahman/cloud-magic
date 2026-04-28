# AWS Magic - Cloud Infrastructure Builder

A full-stack application to visually configure and deploy AWS infrastructure using Terraform.

## Tech Stack
- **Frontend**: React (Vite), Vanilla CSS, Lucide Icons.
- **Backend**: Spring Boot, Java 17+, Maven.
- **Infrastructure**: Terraform CLI.

## Project Structure
- `frontend/`: The React dashboard.
- `backend/`: The Spring Boot API.
- `terraform-workdir/`: Directory where generated Terraform files are stored and executed.

## Getting Started

### Prerequisites
- Java 17 or higher.
- Node.js & npm.
- Terraform CLI installed and in your PATH.
- AWS Credentials configured on your machine (`aws configure`).

### Running the Backend
1. Navigate to the `backend` directory.
2. Run `./mvnw spring-boot:run` (or use your IDE).
3. The API will be available at `http://localhost:8080`.

### Running the Frontend
1. Navigate to the `frontend` directory.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173` in your browser.

## Features
- **Dynamic EC2 Configuration**: Set instance name, AMI, type, region, and security ports.
- **Real-time Preview**: See the Terraform HCL code update as you type.
- **One-Click Deployment**: Trigger `terraform init` and `terraform apply` directly from the UI.
- **Console Feedback**: View real-time logs from the Terraform execution process.
