pipeline {
    agent any

    environment {
        BACKEND_IMAGE  = 'ticketx-backend:latest'
        FRONTEND_IMAGE = 'ticketx-frontend:latest'
    }

    stages {
        stage('1. Checkout') {
            steps {
                echo '=== ดึงโค้ดล่าสุดจาก Git ==='
                checkout scm
            }
        }

        stage('2. Build & Test Backend') {
            steps {
                dir('system/backend') {
                    echo '=== กำลังตรวจเช็คและคอมไพล์ Backend TypeScript ==='
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('3. Build & Test Frontend') {
            steps {
                dir('system/frontend') {
                    echo '=== กำลังตรวจเช็คและคอมไพล์ Frontend React/Vite ==='
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('4. Build Docker Images') {
            steps {
                echo '=== กำลังสร้าง Docker Containers ==='
                sh 'docker build -t ${BACKEND_IMAGE} -f system/backend/Dockerfile system/backend'
                sh 'docker build -t ${FRONTEND_IMAGE} -f system/frontend/Dockerfile system/frontend'
            }
        }

        stage('5. Deploy via Docker Compose') {
            steps {
                echo '=== สั่งเปิดใช้งานระบบด้วย Docker Compose ==='
                dir('ops') {
                    sh 'docker-compose down || true'
                    sh 'docker-compose up -d --build'
                }
            }
        }
    }

    post {
        success {
            echo '🎉 TicketX Deployment สำเร็จเรียบร้อย! ระบบพร้อมใช้งาน'
        }
        failure {
            echo '❌ การ Deployment ล้มเหลว กรุณาตรวจสอบ Console Logs'
        }
    }
}
