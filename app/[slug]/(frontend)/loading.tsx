export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-50">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent"></div>
                <p className="text-gray-500 font-medium animate-pulse">Loading...</p>
            </div>
        </div>
    );
}
