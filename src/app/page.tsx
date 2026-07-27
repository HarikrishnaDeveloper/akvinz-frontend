import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">
        Welcome to Akvins
      </h1>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/customerForm"
          className="px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Go to Customer Registration Form
        </Link>
        <Link
          href="/rentForm"
          className="px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Pay Monthly Rent
        </Link>
        <Link
          href="/returnForm"
          className="px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
        >
          Return Product / Discontinue Subscription
        </Link>
      </div>
    </div>
  );
}
