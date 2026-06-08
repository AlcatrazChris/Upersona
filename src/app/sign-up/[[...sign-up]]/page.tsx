import { redirect } from 'next/navigation';

// 不开放自助注册，统一由管理员在系统内创建账号
export default function SignUpPage() {
  redirect('/sign-in');
}
